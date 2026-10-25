import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {configDirectory,type Config} from './config.js';
export type Credentials={kind:'oauth';access_token:string;refresh_token:string;expires_at:number;needsLogin?:boolean}|{kind:'legacy';token:string};
export interface CredentialStore {get():Promise<Credentials|null>;set(value:Credentials):Promise<void>;clear():Promise<void>}
export class KeychainStore implements CredentialStore {
 constructor(private config:Config){}
 private async entry(){const {Entry}=await import('@napi-rs/keyring');return new Entry('StudioRelay CLI',createHash('sha256').update(this.config.server+'|'+this.config.profile).digest('hex'),{linux:{store:'secret-service'}});}
 async get(){try{const raw=(await this.entry()).getPassword();return raw?JSON.parse(raw) as Credentials:null;}catch(error){if(/No entry|NoEntry|not found|No matching/i.test(String(error)))return null;throw new Error('Coffre système indisponible ou verrouillé. Aucun stockage en clair ne sera utilisé.');}}
 async set(value:Credentials){try{(await this.entry()).setPassword(JSON.stringify(value));}catch{throw new Error('Impossible d’enregistrer la session dans le coffre système.');}}
 async clear(){try{(await this.entry()).deletePassword();}catch(error){if(!/No entry|NoEntry|not found|No matching/i.test(String(error)))throw new Error('Impossible de supprimer la session du coffre système.');}}
}
export async function withCredentialLock<T>(work:()=>Promise<T>):Promise<T>{
 const base=configDirectory();await mkdir(base,{recursive:true,mode:0o700});const path=join(base,'credentials.lock');let owned=false;
 for(let attempt=0;attempt<100;attempt++){
  try{await mkdir(path,{mode:0o700});owned=true;await writeFile(join(path,'pid'),String(process.pid),{mode:0o600});break;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
   try{const pid=Number(await readFile(join(path,'pid'),'utf8'));if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH'){await unlink(join(path,'pid'));await rmdir(path);}}}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }
 if(!owned)throw new Error('Une autre instance utilise la session ; réessayez plus tard.');
 try{return await work();}finally{await unlink(join(path,'pid'));await rmdir(path);}
}
export async function oauthRequest(server:string,path:string,data:Record<string,string>,fetcher:typeof fetch=fetch){
 const response=await fetcher(server+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
 if(!response.ok)throw new Error('Authentification refusée. Reconnectez le CLI ou vérifiez les sessions dans StudioRelay.');
 if(response.status===200&&path.endsWith('/revoke/'))return null;
 let value:Record<string,unknown>;try{value=await response.json() as Record<string,unknown>;}catch{throw new Error('Réponse OAuth illisible.');}
 if(typeof value.access_token!=='string'||typeof value.refresh_token!=='string'||typeof value.expires_in!=='number')throw new Error('Réponse OAuth invalide.');
 return {kind:'oauth',access_token:value.access_token,refresh_token:value.refresh_token,expires_at:Date.now()+value.expires_in*1000} as const;
}
export async function bearer(config:Config,store:CredentialStore,fetcher:typeof fetch=fetch){
 return withCredentialLock(async()=>{
  const current=await store.get();if(!current)throw new Error('Session absente. Exécutez studiorelay login.');
  if(current.kind==='legacy')return current.token;
  if(current.needsLogin)throw new Error('Renouvellement incertain. Reconnectez le CLI ; ne rejouez pas l’ancien jeton.');
  if(current.expires_at>Date.now()+30000)return current.access_token;
  try{const next=await oauthRequest(config.server,'/connector/token/',{client_id:'studiorelay-cli',grant_type:'refresh_token',refresh_token:current.refresh_token},fetcher);if(!next)throw new Error();await store.set(next);return next.access_token;}
  catch{await store.set({...current,needsLogin:true});throw new Error('Session expirée ou renouvellement incertain. Relancez studiorelay login.');}
 });
}
