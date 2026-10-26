import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {hash} from './client.js';
import type {Config} from './config.js';
const executable=fileURLToPath(new URL('./cli.js',import.meta.url));
async function read(file:string){try{return await readFile(file,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}}
async function write(file:string,text:string,previous:string|null){
 await mkdir(dirname(file),{recursive:true,mode:0o700});if(await read(file)!==previous)throw new Error('Configuration hôte modifiée simultanément ; réessayez.');
 const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,text,{flag:'wx',mode:0o600});await rename(temp,file);
}
/** Project-only MCP configuration. Never reads or changes host subscription/auth files. */
export async function projectHost(config:Config,host:'claude'|'codex',remove=false){
 if(!config.localFile||!config.binding)throw new Error('Connectez d’abord ce studio local avec login.');
 const root=config.mediaRoot,receiptFile=join(root,'.studiorelay',host+'-mcp.json'),receiptRaw=await read(receiptFile);
 const receipt=receiptRaw?JSON.parse(receiptRaw):null;
 const file=host==='claude'?join(root,'.mcp.json'):join(root,'.codex','config.toml'),before=await read(file);
 const args=[executable,'mcp','--studio',root];let after:string;let owned:unknown;
 if(host==='claude'){
  const value=before?JSON.parse(before):{};value.mcpServers??={};const existing=value.mcpServers.studiorelay;
  if(existing&&(!receipt||hash(existing)!==receipt.hash))throw new Error('Entrée MCP StudioRelay modifiée ou non gérée : conservée.');
  if(remove){if(!receipt)return {removed:false,scope:'project'};delete value.mcpServers.studiorelay;}
  else{owned={command:process.execPath,args};value.mcpServers.studiorelay=owned;}
  after=JSON.stringify(value,null,2)+'\n';
 }else{
  const start='# BEGIN STUDIORELAY MANAGED MCP',end='# END STUDIORELAY MANAGED MCP';let text=before||'';
  if(receipt){if(!text.includes(receipt.block)||hash(receipt.block)!==receipt.hash)throw new Error('Bloc MCP StudioRelay modifié : conservé.');text=text.replace(receipt.block,'');}
  if(/\[\s*mcp_servers\s*\.\s*["']?studiorelay["']?\s*(?:\]|\.)/i.test(text)||text.includes(start)||text.includes(end))throw new Error('Entrée MCP StudioRelay existante : conservée.');
  if(remove){if(!receipt)return {removed:false,scope:'project'};after=text;}
  else{owned='\n'+start+'\n[mcp_servers.studiorelay]\ncommand = '+JSON.stringify(process.execPath)+'\nargs = '+JSON.stringify(args)+'\ncwd = '+JSON.stringify(root)+'\n'+end+'\n';after=text+owned;}
 }
 const skillRoot=host==='claude'?join(root,'.claude','skills','studiorelay'):join(root,'.agents','skills','studiorelay');
 const source=host==='claude'?'../skill/SKILL.md':'../skill/codex/SKILL.md';
 const plans=[];
 for(const [name,url] of [['SKILL.md',source],['contracts/api-import.schema.json','../contracts/api-import.schema.json']]){
  const target=join(skillRoot,name),content=await readFile(new URL(url,import.meta.url),'utf8'),existing=await read(target),prior=receipt?.skills?.find((s:{name:string})=>s.name===name);
  if(!remove&&existing!==null&&existing!==content&&!(prior?.created&&prior.hash===hash(existing)))throw new Error('Skill local personnalisé : conservé, installation interrompue.');
  plans.push({name,target,content,existing,created:existing===null||prior?.created===true,prior});
 }
 await write(file,after,before);
 if(remove){
  const preserved=[];
  for(const plan of plans)if(plan.prior?.created&&plan.existing!==null){if(hash(plan.existing)===plan.prior.hash)await unlink(plan.target);else preserved.push(plan.name);}
  if(receiptRaw)await unlink(receiptFile);return {removed:true,scope:'project',file,preserved,message:'Session StudioRelay non révoquée ; autres paramètres conservés.'};
 }
 for(const plan of plans)if(plan.existing!==plan.content)await write(plan.target,plan.content,plan.existing);
 const next={hash:hash(owned),...(host==='codex'?{block:owned}:{}),skills:plans.map(p=>({name:p.name,created:p.created,hash:hash(p.content)}))};
 await write(receiptFile,JSON.stringify(next,null,2)+'\n',receiptRaw);
 return {installed:true,scope:'project',file,studio:root,profile:config.profile,brand:config.binding.brandSlug,restart:'Redémarrez Claude Code/Codex dans ce projet. Approuvez sa configuration MCP si demandé. Aucun abonnement hôte modifié.'};
}
