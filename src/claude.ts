import {readFile,writeFile,mkdir,unlink,rmdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import spawn from 'cross-spawn';
import {configDirectory} from './config.js';
import {hash} from './client.js';
const executable=fileURLToPath(new URL('./cli.js',import.meta.url));
const sources={'SKILL.md':new URL('../skill/SKILL.md',import.meta.url),'contracts/api-import.schema.json':new URL('../contracts/api-import.schema.json',import.meta.url)};
interface OwnedFile {path:string;hash:string;created:boolean}
interface Receipt {executable:string;directory:string;files:OwnedFile[];createdMcp:boolean}
export function claudePaths(){const directory=process.env.CLAUDE_CONFIG_DIR?resolve(process.env.CLAUDE_CONFIG_DIR):join(homedir(),'.claude');return {directory,configuration:process.env.CLAUDE_CONFIG_DIR?join(directory,'.claude.json'):join(homedir(),'.claude.json'),skill:join(directory,'skills','studiorelay')};}
function command(args:string[]){const result=spawn.sync('claude',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});if(result.error||result.status!==0)throw new Error('Commande Claude Code impossible. Installer Claude Code, puis relancer. Aucun secret transmis.');}
async function optionalRead(file:string){try{return await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
async function configuredEntry(){const text=await optionalRead(claudePaths().configuration);if(text===null)return undefined;try{return JSON.parse(text).mcpServers?.studiorelay;}catch{throw new Error('Configuration Claude Code illisible ; aucun fichier ne sera remplacé.');}}
function isOwn(entry:any){return entry?.command===process.execPath&&JSON.stringify(entry?.args)===JSON.stringify([executable,'mcp']);}
async function previousReceipt():Promise<Receipt|null>{const text=await optionalRead(join(configDirectory(),'claude-install.json'));return text?JSON.parse(text):null;}
export async function installClaude(){
 const paths=claudePaths(),entry=await configuredEntry(),previous=await previousReceipt();
 if(entry&&!isOwn(entry))throw new Error('Un serveur MCP nommé studiorelay existe déjà. Aucun remplacement automatique.');
 if(previous&&previous.directory!==paths.directory)throw new Error('Le dossier Claude Code a changé. Désinstallez d’abord dans l’ancienne configuration.');
 const plan=[];
 for(const [path,url] of Object.entries(sources)){
  const text=await readFile(url,'utf8'),target=join(paths.skill,path),existing=await optionalRead(target),owned=previous?.files.find(file=>file.path===path);
  if(existing!==null&&existing!==text&&!(owned?.created&&owned.hash===hash(existing)))throw new Error('Skill ou contrat modifié : conservé. Renommez-le avant installation.');
  plan.push({path,target,text,existing,created:existing===null||owned?.created===true});
 }
 if(!entry)command(['mcp','add','--transport','stdio','--scope','user','studiorelay','--',process.execPath,executable,'mcp']);
 for(const file of plan){if(file.existing!==file.text){await mkdir(dirname(file.target),{recursive:true,mode:0o700});if(await optionalRead(file.target)!==file.existing)throw new Error('Fichier changé pendant l’installation ; conservé.');const temp=file.target+'.'+process.pid+'.tmp';await writeFile(temp,file.text,{flag:'wx',mode:0o600});await rename(temp,file.target);}}
 const receipt:Receipt={executable,directory:paths.directory,files:plan.map(file=>({path:file.path,hash:hash(file.text),created:file.created})),createdMcp:!entry||previous?.createdMcp===true};
 await mkdir(configDirectory(),{recursive:true,mode:0o700});await writeFile(join(configDirectory(),'claude-install.json'),JSON.stringify(receipt),{mode:0o600});
 return {installed:true,scope:'user',restart:'Redémarrez Claude Code, puis vérifiez /mcp. Les permissions de l’hôte restent applicables.'};
}
export async function uninstallClaude(){
 const paths=claudePaths(),receipt=await previousReceipt();if(!receipt)throw new Error('Aucun reçu d’installation : aucun fichier supprimé.');
 if(receipt.directory!==paths.directory)throw new Error('Configuration Claude différente du reçu : aucun fichier supprimé.');
 const entry=await configuredEntry();if(receipt.createdMcp&&entry){if(!isOwn(entry))throw new Error('Le serveur MCP a changé : suppression manuelle nécessaire.');command(['mcp','remove','--scope','user','studiorelay']);}
 const preserved=[];
 for(const file of receipt.files){if(!Object.hasOwn(sources,file.path))throw new Error('Reçu invalide : chemin non autorisé.');const text=await optionalRead(join(paths.skill,file.path));if(file.created&&text!==null&&hash(text)!==file.hash)preserved.push(file.path);}
 if(!preserved.length){for(const file of receipt.files)if(file.created){try{await unlink(join(paths.skill,file.path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}for(const dir of [join(paths.skill,'contracts'),paths.skill])try{await rmdir(dir);}catch{}}
 await unlink(join(configDirectory(),'claude-install.json'));return {removed:true,preserved,message:'MCP retiré. Les fichiers modifiés sont conservés. Exécutez logout pour révoquer la session.'};
}
