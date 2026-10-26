import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import {randomUUID} from 'node:crypto';
import {StudioRelayClient,APIError,type Manifest,type Review} from './client.js';
import {VERSION} from './version.js';
const id=z.string().uuid(),date=z.iso.datetime({offset:true});
export function createMcpServer(client:StudioRelayClient){
 const server=new McpServer({name:'studiorelay',version:VERSION},{instructions:'Avant toute préparation, appelez identity puis list_accounts. Affichez le dossier local, la marque et les comptes visés ; comparez avec la demande. En cas de différence, arrêtez sans import ni approbation. Ne modifiez pas le profil pour contourner un refus. Les abonnements Claude/Codex sont indépendants de la marque StudioRelay. Respectez les droits serveur, les règles éditoriales et les clés d’idempotence. Une programmation ne prouve pas une publication sociale.'});
 const reviews=new Map<string,{batch:string;review:Review;integration:string;expires:number}>();
 function register(name:string,description:string,schema:z.ZodObject,readOnly:boolean,handler:(input:any)=>Promise<unknown>){
  server.registerTool(name,{description,inputSchema:schema,annotations:{readOnlyHint:readOnly,destructiveHint:!readOnly,idempotentHint:true,openWorldHint:true}},async(input)=>{
   try{const data=await handler(input);return {content:[{type:'text' as const,text:JSON.stringify(data)}]};}
   catch(error){const value=error instanceof APIError?{code:error.code,status:error.status,message:error.message,details:error.details}:{code:'client_error',message:error instanceof Error?error.message:'Erreur du connecteur.'};return {isError:true,content:[{type:'text' as const,text:JSON.stringify({error:value})}]};}
  });
 }
 register('identity','Consulter les droits et limites effectifs ; aucun secret social.',z.object({}).strict(),true,async()=>({...await client.identity(),local_studio:{profile:client.config.profile,mediaRoot:client.config.mediaRoot,binding:client.config.binding,configuration:client.config.localFile||'legacy-global'}}));
 register('list_accounts','Lister uniquement les comptes autorisés. Paginer si count dépasse les résultats.',z.object({offset:z.number().int().min(0).max(10000).default(0)}).strict(),true,({offset})=>client.accounts(offset));
 register('list_publications','Lister les publications du studio. scope=accounts exige read_history ; ne permet pas leur annulation depuis une autre intégration.',z.object({scope:z.enum(['own','accounts']).default('own'),account_id:z.number().int().positive().optional(),state:z.enum(['draft','ready','scheduled','sending','processing','published','failed','cancelled','review','manual']).optional(),offset:z.number().int().min(0).max(10000).default(0)}).strict(),true,input=>client.publications(Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]))));
 register('get_schedule','Consulter le planning et les occupations des comptes autorisés, avec neuf jours de contexte pour l’espacement. Ne réserve rien.',z.object({from:date,until:date,offset:z.number().int().min(0).default(0)}).strict(),true,async({from,until,offset})=>{const planning=await client.schedule(from,until);return {...planning,offset,results:planning.results.slice(offset,offset+100),next_offset:offset+100<planning.results.length?offset+100:null,truncated:offset+100<planning.results.length};});
 register('suggest_slots','Proposer des dates à partir des règles existantes, sans les inventer ni réserver. count représente des vidéos différentes ; chaque proposition tient compte des précédentes.',z.object({account_ids:z.array(z.number().int().positive()).min(1).max(50),from:date,until:date,count:z.number().int().min(1).max(30).default(1)}).strict(),true,({account_ids,from,until,count})=>client.slots(account_ids,from,until,count));
 register('upload_video','Importer un MP4 local sous mediaRoot. manifest suit contracts/api-import.schema.json. Réutiliser la même clé en cas de doute ; aucune publication.',z.object({file:z.string().min(1),manifest:z.record(z.string(),z.unknown()),idempotency_key:z.string().min(1).max(160)}).strict(),false,({file,manifest,idempotency_key})=>client.upload(file,manifest as Manifest,idempotency_key));
 register('get_import','Suivre la préparation technique du média avant de créer les brouillons.',z.object({import_id:id}).strict(),true,({import_id})=>client.request('/api/v1/imports/'+import_id+'/'));
 register('create_drafts','Créer un groupe de brouillons avec les textes, paramètres et dates explicites du manifeste. N’approuve rien.',z.object({import_id:id,idempotency_key:z.string().min(1).max(160)}).strict(),false,({import_id,idempotency_key})=>client.createBatch(import_id,idempotency_key));
 register('get_batch','Lire le groupe et les états officiels disponibles.',z.object({batch_id:id}).strict(),true,({batch_id})=>client.batch(batch_id));
 register('review_batch','Effectuer la relecture technique. La preuve signée reste dans le connecteur ; seul un handle opaque est fourni.',z.object({batch_id:id}).strict(),true,async({batch_id})=>{
  for(const [key,value] of reviews)if(value.expires<Date.now())reviews.delete(key);
  if(reviews.size>=100)throw new Error('Trop de relectures ouvertes ; terminer les groupes en cours.');
  const me=await client.identity(),review=await client.review(batch_id),handle=randomUUID();reviews.set(handle,{batch:batch_id,review,integration:me.integration_id,expires:Date.now()+review.expires_in_seconds*1000});
  const {review_token,...safe}=review;return {...safe,review_handle:handle};
 });
 register('approve_batch','Approuver réellement le groupe relu, uniquement si le mode automatique et approve sont autorisés côté StudioRelay. Ne demande aucune confirmation supplémentaire dans ce cas.',z.object({review_handle:id}).strict(),false,async({review_handle})=>{
  const value=reviews.get(review_handle),me=await client.identity();if(!value||value.expires<Date.now()||value.integration!==me.integration_id)throw new Error('Relire le groupe : handle expiré ou session modifiée.');
  if(!me.auto_approve||!me.permissions.includes('approve'))throw new Error('Approbation automatique non autorisée par StudioRelay.');
  return client.approve(value.batch,value.review,'approve:'+value.batch+':'+value.review.revision);
 });
 register('approve_with_replan','Relire et approuver ; en cas de conflit de créneau, relire le planning, proposer de nouvelles dates, relire à nouveau et réessayer au maximum trois fois. Aucun groupe partiellement approuvé.',z.object({batch_id:id,from:date,until:date,max_attempts:z.number().int().min(1).max(3).default(3)}).strict(),false,async({batch_id,from,until,max_attempts})=>{
  const me=await client.identity();if(!me.auto_approve||!me.permissions.includes('approve'))throw new Error('Mode automatique non autorisé.');return client.approveWithReplan(batch_id,from,until,max_attempts);
 });
 register('get_publication','Lire le statut sans présenter une programmation comme une publication confirmée.',z.object({publication_id:id}).strict(),true,({publication_id})=>client.publication(publication_id));
 register('cancel_publication','Annuler une publication propre à ce studio, non engagée à distance. Exige cancel et la révision obtenue en relisant le statut. N’efface aucune publication sociale.',z.object({publication_id:id,revision:z.string().regex(/^[a-f0-9]{64}$/),idempotency_key:z.string().min(1).max(160)}).strict(),false,({publication_id,revision,idempotency_key})=>client.cancel(publication_id,revision,idempotency_key));
 register('recover_operation','Lire une opération incertaine avec sa clé initiale. Une absence ne prouve pas que la demande n’est pas en cours ; ne pas créer de nouvelle clé.',z.object({kind:z.enum(['import','batch','approve','replan','cancel']),idempotency_key:z.string().min(1).max(160)}).strict(),true,({kind,idempotency_key})=>client.operation(kind,idempotency_key));
 return server;
}
export function runMcp(client:StudioRelayClient){return serveStdio(()=>createMcpServer(client));}
