#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadConfig,saveConfig} from './config.js';
import {KeychainStore,withCredentialLock} from './credentials.js';
import {login,logout} from './login.js';
import {StudioRelayClient,hash,type Manifest,type Operation} from './client.js';
import {installClaude,uninstallClaude} from './claude.js';
import {installCodex,uninstallCodex} from './codex.js';
import {runMcp} from './mcp.js';
import {VERSION} from './version.js';
import {automaticUpdateNotice,latestVersion,newer} from './updates.js';
const output=(value:unknown)=>console.log(JSON.stringify(value,null,2));
async function main(){
 const {positionals,values:options}=parseArgs({allowPositionals:true,options:{
  server:{type:'string'},'media-root':{type:'string'},profile:{type:'string'},
  'no-browser':{type:'boolean'},'token-stdin':{type:'boolean'},approve:{type:'boolean'},
  'auto-schedule':{type:'boolean'},from:{type:'string'},until:{type:'string'},
  check:{type:'boolean'},help:{type:'boolean'},version:{type:'boolean'}
 }});
 const [command='help',subcommand]=positionals;
 if(command!=='mcp'&&command!=='update'&&process.stderr.isTTY&&process.stdin.isTTY&&!process.env.CI&&process.env.STUDIORELAY_NO_UPDATE_CHECK!=='1'){
  const notice=await automaticUpdateNotice();if(notice)console.error(notice);
 }
 if(command==='version'||options.version){output({version:VERSION});return;}
 if(command==='help'||options.help){console.log('StudioRelay '+VERSION+'\ninit --server https://studiorelay.fr --media-root DOSSIER\nlogin [--no-browser | --token-stdin]\nclaude install | claude uninstall\ncodex install | codex uninstall\ndoctor | accounts | schedule --from ISO --until ISO\npublish MANIFESTE.json [--auto-schedule --from ISO --until ISO] [--approve]\nmcp | logout | update --check');return;}
 if(command==='init'){const config=await saveConfig(options.server||'https://studiorelay.fr',options['media-root']||process.cwd(),options.profile||'default');output({initialized:true,...config});return;}
 if(command==='update'){const latest=await latestVersion(fetch,15000);output({installed:VERSION,latest,updateAvailable:newer(latest),command:'npm install -g @studiorelay/cli@'+latest});return;}
 const config=await loadConfig(),store=new KeychainStore(config),client=new StudioRelayClient(config,store);
 if(command==='login'){
  if(options['token-stdin']){if(process.stdin.isTTY)throw new Error('Fournissez le jeton par un pipe local, jamais en argument ni dans un prompt.');let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>256)throw new Error('Jeton invalide.');}raw=raw.trim();if(!/^sr1_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/.test(raw))throw new Error('Format de jeton privé invalide.');await withCredentialLock(()=>store.set({kind:'legacy',token:raw}));}
  else await login(config,store,!options['no-browser']);
  output({connected:true,identity:await client.identity()});return;
 }
 if(command==='logout'){output(await logout(config,store));return;}
 if(command==='claude'){output(subcommand==='install'?await installClaude():subcommand==='uninstall'?await uninstallClaude():(()=>{throw new Error('Choisir claude install ou claude uninstall.');})());return;}
 if(command==='codex'){output(subcommand==='install'?await installCodex():subcommand==='uninstall'?await uninstallCodex():(()=>{throw new Error('Choisir codex install ou codex uninstall.');})());return;}
 if(command==='doctor'){const me=await client.identity();output({connected:true,version:VERSION,server:config.server,mediaRoot:config.mediaRoot,identity:me});return;}
 if(command==='accounts'){output(await client.accounts());return;}
 if(command==='schedule'){if(!options.from||!options.until)throw new Error('--from et --until requis.');output(await client.schedule(options.from,options.until));return;}
 if(command==='mcp'){runMcp(client);return;}
 if(command==='publish'){
  if(!subcommand)throw new Error('Fichier manifeste requis.');
  const local=JSON.parse(await readFile(resolve(subcommand),'utf8')) as Manifest&{file:string};
  if(typeof local.file!=='string')throw new Error('Champ file local requis.');const {file,...manifest}=local;
  if(!manifest.destinations?.length)throw new Error('Destinations explicites requises.');
  if(options['auto-schedule']){if(!options.from||!options.until)throw new Error('--from et --until requis.');const slots=await client.slots(manifest.destinations.map(p=>p.account_id),options.from,options.until);manifest.destinations=manifest.destinations.map(p=>({...p,scheduled_at:slots.proposals[0].dates.find(d=>d.account_id===p.account_id)!.scheduled_at}));}
  const key='render:'+hash(manifest.external_id).slice(0,32),operation=await client.upload(file,manifest,key);
  const first=operation.import;if(!first)throw new Error('Import absent de la réponse.');let imported:NonNullable<Operation['import']>=first;
  for(let count=0;!imported.ready&&count<120;count++){if(imported.status==='failed')throw new Error('Préparation vidéo échouée ; consulter StudioRelay.');await new Promise(resolve=>setTimeout(resolve,5000));imported=await client.request<NonNullable<Operation['import']>>('/api/v1/imports/'+imported.id+'/');}
  if(!imported.ready)throw new Error('Préparation encore en cours. Aucun brouillon approuvé.');
  const batch=await client.createBatch(imported.id,'batch:'+imported.id);if(!batch.batch)throw new Error('Groupe absent.');
  if(!options.approve){const {review_token,...review}=await client.review(batch.batch.id);output({approved:false,batch:batch.batch,review});return;}
  if(options['auto-schedule'])output(await client.approveWithReplan(batch.batch.id,options.from!,options.until!));
  else{const review=await client.review(batch.batch.id);output(await client.approve(batch.batch.id,review,'approve:'+batch.batch.id+':'+review.revision));}
  return;
 }
 throw new Error('Commande inconnue. Exécutez studiorelay help.');
}
main().catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:'Échec du connecteur.'}));process.exitCode=1;});
