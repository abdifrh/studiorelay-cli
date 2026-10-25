import {createHash} from 'node:crypto';
import {createReadStream,openAsBlob} from 'node:fs';
import {realpath,stat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {bearer,type CredentialStore} from './credentials.js';
import {configDirectory,origin,type Config} from './config.js';
import {chooseDates} from './planning.mjs';
import type {components} from './contracts.js';
export type Publication=components['schemas']['Publication'];
export type Schedule=components['schemas']['Schedule'];
export type Review=components['schemas']['Review'];
export type Batch=components['schemas']['Batch'];
export type Operation=components['schemas']['Operation'];
export type Manifest=components['schemas']['Manifest'];
export type Identity=components['schemas']['Identity'];
export class APIError extends Error {constructor(public code:string,message:string,public status:number,public details:unknown=null){super(message);}}
export function hash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export class StudioRelayClient {
 constructor(public config:Config,private store:CredentialStore,private fetcher:typeof fetch=fetch){this.config={...config,server:origin(config.server,process.env.STUDIORELAY_ALLOW_LOOPBACK==='1')};}
 async request<T>(path:string,method='GET',body?:BodyInit,headers:Record<string,string>={}):Promise<T>{
  if(!path.startsWith('/api/v1/')||path.includes('..')||path.includes('://'))throw new Error('Route API interdite.');
  const secret=await bearer(this.config,this.store,this.fetcher);
  const response=await this.fetcher(this.config.server+path,{method,body,redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:300000),headers:{...headers,Authorization:'Bearer '+secret}});
  let payload:{data?:T;error?:{code?:string;message?:string;details?:unknown}};
  try{payload=await response.json();}catch{throw new APIError('invalid_response','Réponse API illisible. Une mutation peut être en cours : consulter son opération.',response.status);}
  if(!response.ok){const message=String(payload.error?.message||'Requête refusée.').replaceAll(secret,'[masqué]').slice(0,800);throw new APIError(payload.error?.code||'http_error',message,response.status,payload.error?.details);}
  if(!('data' in payload))throw new APIError('invalid_response','Enveloppe API invalide.',response.status);
  return payload.data as T;
 }
 identity(){return this.request<Identity>('/api/v1/identity/');}
 accounts(offset=0){return this.request<{count:number;results:components['schemas']['Account'][]}>('/api/v1/accounts/?limit=100&offset='+offset);}
 publications(query:Record<string,string>={}){return this.request<{count:number;results:Publication[];next_offset:number|null;truncated:boolean}>('/api/v1/publications/?'+new URLSearchParams(query));}
 publication(id:string){return this.request<Publication>('/api/v1/publications/'+encodeURIComponent(id)+'/');}
 batch(id:string){return this.request<Batch>('/api/v1/batches/'+encodeURIComponent(id)+'/');}
 review(id:string){return this.request<Review>('/api/v1/batches/'+encodeURIComponent(id)+'/review/');}
 operation(kind:string,key:string){return this.request<Operation>('/api/v1/operations/?'+new URLSearchParams({kind,key}));}
 async mutate(kind:string,key:string,path:string,data:unknown,build?:()=>Promise<BodyInit>):Promise<Operation>{
  if(!/^[A-Za-z0-9_.:-]{1,160}$/.test(key))throw new Error('Clé d’idempotence invalide.');
  const me=await this.identity(),dir=join(configDirectory(),'operations');await mkdir(dir,{recursive:true,mode:0o700});
  const file=join(dir,hash([this.config.server,me.integration_id,kind,key])+'.json'),fingerprint=hash((kind==='approve'||kind==='replan')?{...(data as Record<string,unknown>),review_token:undefined}:data);
  let exists=false;
  try{await writeFile(file,JSON.stringify({fingerprint,status:'attempted'}),{mode:0o600,flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;exists=true;}
  if(exists){
   const state=JSON.parse(await readFile(file,'utf8'));
   if(state.fingerprint!==fingerprint)throw new APIError('local_idempotency_conflict','Cette opération a déjà été tentée avec un autre contenu.',409);
   try{return await this.operation(kind,key);}catch(error){if(!(error instanceof APIError)||error.status!==404)throw error;}
   if(state.fingerprint!==fingerprint)throw new APIError('local_idempotency_conflict','Cette opération a déjà été tentée avec un autre contenu.',409);
   if(state.status!=='rejected')throw new APIError('operation_unknown','Résultat incertain. Relire cette opération avec la même clé ; ne pas créer une autre clé.',409,{kind,key});
  }
  try{
   const result=await this.request<Operation>(path,'POST',build?await build():JSON.stringify(data),{'Idempotency-Key':key,...(build?{}:{'Content-Type':'application/json'})});
   await writeFile(file,JSON.stringify({fingerprint,status:'committed'}),{mode:0o600});return result;
  }catch(error){if(error instanceof APIError&&error.status>=400&&error.status<500&&error.code!=='invalid_response')await writeFile(file,JSON.stringify({fingerprint,status:'rejected'}),{mode:0o600});throw error;}
 }
 async upload(file:string,manifest:Manifest,key:string){
  const root=await realpath(this.config.mediaRoot),path=await realpath(resolve(root,file)),rel=relative(root,path),info=await stat(path);
  if(isAbsolute(rel)||rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||!path.toLowerCase().endsWith('.mp4')||!info.isFile())throw new Error('Le MP4 doit rester dans le dossier de médias autorisé.');
  const me=await this.identity();if(info.size>me.limits.upload_bytes)throw new Error('Le fichier dépasse la limite autorisée par StudioRelay.');
  const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);
  const sha256=h.digest('hex');
  const result=await this.mutate('import',key,'/api/v1/imports/',{manifest,sha256},async()=>{const form=new FormData();form.append('manifest',JSON.stringify(manifest));form.append('file',await openAsBlob(path,{type:'video/mp4'}),'video.mp4');return form;});
  if(!result.import||result.import.upload_sha256!==sha256)throw new APIError('upload_hash_mismatch','Le fichier reçu ne correspond pas au rendu lu. Aucun brouillon ne doit être approuvé.',409);
  return result;
 }
 createBatch(importId:string,key:string,destinations?:unknown[]){return this.mutate('batch',key,'/api/v1/batches/',{import_id:importId,...(destinations?{destinations}:{})});}
 replan(id:string,dates:unknown[],review:Review,key:string){return this.mutate('replan',key,'/api/v1/batches/'+encodeURIComponent(id)+'/replan/',{dates,review_token:review.review_token});}
 approve(id:string,review:Review,key:string){
  if(!review.can_approve)throw new APIError('technical_review_failed','La relecture technique signale des prérequis manquants.',422,review.destinations);
  return this.mutate('approve',key,'/api/v1/batches/'+encodeURIComponent(id)+'/approve/',{confirm:true,automatic:true,review_token:review.review_token});
 }
 cancel(id:string,revision:string,key:string){return this.mutate('cancel',key,'/api/v1/publications/'+encodeURIComponent(id)+'/cancel/',{revision});}
 async schedule(from:string,until:string):Promise<Schedule>{
  if(!/[T].*(Z|[+-][0-9]{2}:[0-9]{2})$/.test(from)||!/[T].*(Z|[+-][0-9]{2}:[0-9]{2})$/.test(until))throw new Error('Dates ISO avec fuseau explicite requises.');
  const start=+new Date(from),end=+new Date(until);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>31*86400000)throw new Error('Période positive de 31 jours maximum requise.');
  const rows=new Map(),accounts=new Map();
  // Nine days of context cover seven-day spacing and local-calendar-day boundaries.
  for(let a=start-9*86400000;a<end+9*86400000;a+=31*86400000){
   const b=Math.min(a+31*86400000,end+9*86400000);let offset=0;
   for(let pageNumber=0;pageNumber<102;pageNumber++){
    const page=await this.request<Schedule>('/api/v1/schedule/?'+new URLSearchParams({from:new Date(a).toISOString(),until:new Date(b).toISOString(),limit:'100',offset:String(offset)}));
    for(const row of page.results)rows.set(row.id,row);for(const account of page.accounts)accounts.set(account.account_id,account);
    if(!page.truncated)break;
    if(page.next_offset===null||page.next_offset<=offset||pageNumber===101)throw new Error('Planning incomplet : réduire la période.');offset=page.next_offset;
   }
  }
  return {accounts:[...accounts.values()],results:[...rows.values()],count:rows.size,offset:0,limit:100,next_offset:null,truncated:false};
 }
 async slots(accountIds:number[],from:string,until:string,count=1){
  if(!accountIds.length||accountIds.length>50||new Set(accountIds).size!==accountIds.length||accountIds.some(id=>!Number.isInteger(id)||id<1))throw new Error('Comptes distincts autorisés requis, maximum 50.');
  if(count<1||count>30||!Number.isInteger(count))throw new Error('Choisir de 1 à 30 vidéos.');
  const planning=await this.schedule(from,until),proposals=[];
  for(let index=0;index<count;index++){
   const dates=chooseDates(accountIds.map(account_id=>({account_id})),planning,from,until);
   proposals.push({index,dates});
   for(const date of dates)planning.results.push({id:'proposal-'+index+'-'+date.account_id,account_id:date.account_id,effective_at:date.scheduled_at,scheduled_at:date.scheduled_at,state:'scheduled',occupied:true,blocking:false,time_basis:'scheduled_at'});
  }
  return {reserved:false,proposals};
 }
 async approveWithReplan(id:string,from:string,until:string,maxAttempts=3){
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw new Error('De 1 à 3 tentatives maximum.');
  for(let attempt=0;attempt<maxAttempts;attempt++){
   const review=await this.review(id);
   try{return await this.approve(id,review,'approve:'+id+':'+review.revision);}
   catch(error){
    if(!(error instanceof APIError)||error.code!=='schedule_conflict'||attempt===maxAttempts-1)throw error;
    const batch=await this.batch(id),proposal=await this.slots(batch.publications.map(p=>p.account_id),from,until);
    const fresh=await this.review(id);
    await this.replan(id,proposal.proposals[0].dates,fresh,'replan:'+id+':'+hash(proposal.proposals[0].dates).slice(0,32));
   }
  }
  throw new Error('Nombre de tentatives atteint.');
 }
}
