import {readFile,writeFile,mkdir,unlink,rmdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import spawn from 'cross-spawn';
import {configDirectory} from './config.js';
import {hash} from './client.js';

const executable=fileURLToPath(new URL('./cli.js',import.meta.url));
const sources={'SKILL.md':new URL('../skill/codex/SKILL.md',import.meta.url),'contracts/api-import.schema.json':new URL('../contracts/api-import.schema.json',import.meta.url)};
interface OwnedFile {path:string;hash:string;created:boolean}
interface Receipt {directory:string;skill:string;files:OwnedFile[];createdMcp:boolean}
interface Options {skillsRoot?:string}
export function codexPaths(options:Options={}){return {directory:process.env.CODEX_HOME?resolve(process.env.CODEX_HOME):join(homedir(),'.codex'),skill:join(options.skillsRoot||join(homedir(),'.agents','skills'),'studiorelay')};}
async function optionalRead(path:string){try{return await readFile(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
function command(args:string[],allowAbsent=false){
 const result=spawn.sync('codex',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(!result.error&&result.status===0)return result.stdout;
 if(allowAbsent&&!result.error&&result.status===1&&/No MCP server named 'studiorelay' found\./.test(String(result.stderr)))return null;
 throw new Error('Commande Codex impossible. Vérifiez son installation et sa configuration ; aucun remplacement effectué.');
}
function configuredEntry(){const raw=command(['mcp','get','studiorelay','--json'],true);if(raw===null)return null;try{return JSON.parse(raw);}catch{throw new Error('Configuration Codex illisible ; aucun remplacement effectué.');}}
function isOwn(entry:any){return entry?.transport?.type==='stdio'&&entry.transport.command===process.execPath&&JSON.stringify(entry.transport.args)===JSON.stringify([executable,'mcp']);}
async function receipt():Promise<Receipt|null>{const raw=await optionalRead(join(configDirectory(),'codex-install.json'));return raw?JSON.parse(raw):null;}
export async function installCodex(options:Options={}){
 const paths=codexPaths(options),entry=configuredEntry(),previous=await receipt();
 if(entry&&!isOwn(entry))throw new Error('Un serveur MCP nommé studiorelay existe déjà dans Codex. Aucun remplacement automatique.');
 if(previous&&(previous.directory!==paths.directory||previous.skill!==paths.skill))throw new Error('Les dossiers Codex ont changé. Désinstallez dans l’ancienne configuration.');
 const plan=[];
 for(const [path,url] of Object.entries(sources)){
  const text=await readFile(url,'utf8'),target=join(paths.skill,path),existing=await optionalRead(target),owned=previous?.files.find(file=>file.path===path);
  if(existing!==null&&existing!==text&&!(owned?.created&&owned.hash===hash(existing)))throw new Error('Skill ou contrat Codex modifié : conservé. Renommez-le avant installation.');
  plan.push({path,target,text,existing,created:existing===null||owned?.created===true});
 }
 if(!entry)command(['mcp','add','studiorelay','--',process.execPath,executable,'mcp']);
 for(const file of plan){if(file.existing!==file.text){await mkdir(dirname(file.target),{recursive:true,mode:0o700});if(await optionalRead(file.target)!==file.existing)throw new Error('Fichier changé pendant l’installation ; conservé.');const temp=file.target+'.'+process.pid+'.tmp';await writeFile(temp,file.text,{flag:'wx',mode:0o600});await rename(temp,file.target);}}
 const next:Receipt={...paths,files:plan.map(file=>({path:file.path,hash:hash(file.text),created:file.created})),createdMcp:!entry||previous?.createdMcp===true};
 await mkdir(configDirectory(),{recursive:true,mode:0o700});await writeFile(join(configDirectory(),'codex-install.json'),JSON.stringify(next),{mode:0o600});
 return {installed:true,scope:'user',restart:'Redémarrez Codex, vérifiez le serveur studiorelay dans les paramètres MCP ou /mcp, puis utilisez le Skill $studiorelay. Les permissions de Codex restent applicables.'};
}
export async function uninstallCodex(options:Options={}){
 const paths=codexPaths(options),previous=await receipt();if(!previous)throw new Error('Aucun reçu Codex : aucun fichier supprimé.');
 if(previous.directory!==paths.directory||previous.skill!==paths.skill)throw new Error('Configuration Codex différente du reçu : aucun fichier supprimé.');
 const entry=configuredEntry();if(previous.createdMcp&&entry){if(!isOwn(entry))throw new Error('Le serveur MCP a changé : suppression manuelle nécessaire.');command(['mcp','remove','studiorelay']);}
 const preserved=[];
 for(const file of previous.files){if(!Object.hasOwn(sources,file.path))throw new Error('Reçu invalide : chemin non autorisé.');const text=await optionalRead(join(paths.skill,file.path));if(file.created&&text!==null&&hash(text)!==file.hash)preserved.push(file.path);}
 if(!preserved.length){for(const file of previous.files)if(file.created){try{await unlink(join(paths.skill,file.path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}for(const dir of [join(paths.skill,'contracts'),paths.skill])try{await rmdir(dir);}catch{}}
 await unlink(join(configDirectory(),'codex-install.json'));return {removed:true,preserved,message:'MCP Codex retiré. Les fichiers modifiés sont conservés. Exécutez logout pour révoquer la session partagée.'};
}
