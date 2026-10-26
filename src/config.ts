import {mkdir,readFile,writeFile,rename,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
export interface Config {server:string;mediaRoot:string;profile:string;version:1;localFile?:string;expectedBrand?:string;binding?:{integrationId:string;brandId:number;brandSlug:string}}
export function configDirectory(){return process.env.STUDIORELAY_CONFIG_DIR || (process.platform==='win32'?join(process.env.APPDATA||homedir(),'StudioRelay'):process.platform==='darwin'?join(homedir(),'Library','Application Support','StudioRelay'):join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'studiorelay'));}
export function origin(value:string,allowLoopback=false){
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(allowLoopback&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new Error('Adresse HTTPS de StudioRelay requise, sans chemin, identifiants ni paramètres.');
 return url.origin;
}
export async function loadConfig(options:{studio?:string;requireLocal?:boolean}={}):Promise<Config>{
 let directory=await realpath(resolve(options.studio||process.cwd()));
 while(true){
  const file=join(directory,'.studiorelay','config.json');
  let raw:string|null=null;
  try{raw=await readFile(file,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(raw!==null){const value=JSON.parse(raw);validate(value);if(await realpath(value.mediaRoot)!==directory)throw new Error('Studio déplacé : réinitialisez explicitement son dossier.');return {...value,localFile:file};}
  if(options.studio||dirname(directory)===directory)break;directory=dirname(directory);
 }
 if(options.studio||options.requireLocal)throw new Error('Aucun studio local. Lancez studiorelay init dans le dossier du studio ; aucun profil global utilisé.');
 const value=JSON.parse(await readFile(join(configDirectory(),'config.json'),'utf8'));validate(value);return value;
}
function validate(value:Config){
 if(value.version!==1||typeof value.mediaRoot!=='string'||!isAbsolute(value.mediaRoot)||typeof value.profile!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(value.profile))throw new Error('Configuration invalide ; relancez studiorelay init.');
 value.server=origin(value.server,process.env.STUDIORELAY_ALLOW_LOOPBACK==='1');
 if(value.binding&&(!/^[a-f0-9-]{36}$/i.test(value.binding.integrationId)||(!Number.isSafeInteger(value.binding.brandId)||value.binding.brandId<=0)||!value.binding.brandSlug))throw new Error('Identité du studio invalide.');
}
export async function saveConfig(server:string,mediaRoot:string,profile='default'){
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(profile))throw new Error('Nom de profil invalide.');
 const value:Config={version:1,server:origin(server,process.env.STUDIORELAY_ALLOW_LOOPBACK==='1'),mediaRoot:await realpath(resolve(mediaRoot)),profile};
 const dir=configDirectory();await mkdir(dir,{recursive:true,mode:0o700});
 const temp=join(dir,`config.${process.pid}.tmp`);await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,join(dir,'config.json'));return value;
}

async function atomicConfig(file:string,value:Config){
 const {localFile,...data}=value;await mkdir(dirname(file),{recursive:true,mode:0o700});
 const temporary=file+'.'+process.pid+'.'+Date.now()+'.tmp';await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,file);
}
export async function saveStudioConfig(server:string,mediaRoot:string,profile?:string,expectedBrand?:string){
 const root=await realpath(resolve(mediaRoot)),file=join(root,'.studiorelay','config.json');
 const value:Config={version:1,server:origin(server),mediaRoot:root,profile:profile||'studio-'+createHash('sha256').update(root).digest('hex').slice(0,20),...(expectedBrand?{expectedBrand}:{})};validate(value);
 try{const previous=JSON.parse(await readFile(file,'utf8'));validate(previous);
  if(!profile)value.profile=previous.profile;
  if(previous.server!==value.server||previous.mediaRoot!==root||previous.profile!==value.profile||(expectedBrand&&previous.expectedBrand!==expectedBrand&&previous.binding?.brandSlug!==expectedBrand))throw new Error('Ce dossier est déjà configuré différemment. Configuration conservée ; utilisez un autre dossier ou modifiez-la explicitement après vérification.');
  return {...previous,localFile:file} as Config;
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await mkdir(dirname(file),{recursive:true,mode:0o700});const {localFile,...data}=value;
 await writeFile(file,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});return {...value,localFile:file};
}
export async function assertStudioConfig(config:Config){
 if(!config.localFile)return;
 const current=JSON.parse(await readFile(config.localFile,'utf8'));const {localFile,...snapshot}=config;
 if(JSON.stringify(current)!==JSON.stringify(snapshot))throw new Error('Configuration du studio modifiée. Redémarrez le connecteur avant de poursuivre.');
}
export function assertStudioIdentity(config:Config,identity:{integration_id:string;brand:{id:number;slug:string}}){
 if(config.expectedBrand&&identity.brand.slug!==config.expectedBrand)throw new Error('Marque différente de celle attendue : connexion bloquée.');
 if(config.binding&&(identity.integration_id!==config.binding.integrationId||identity.brand.id!==config.binding.brandId||identity.brand.slug!==config.binding.brandSlug))throw new Error('La session appartient à une autre intégration ou marque : opération bloquée. Reconnectez la bonne intégration.');
}
export async function bindStudio(config:Config,identity:{integration_id:string;brand:{id:number;slug:string}}){
 assertStudioIdentity(config,identity);if(!config.localFile)return config;await assertStudioConfig(config);
 const next={...config,binding:{integrationId:identity.integration_id,brandId:identity.brand.id,brandSlug:identity.brand.slug}};await atomicConfig(config.localFile,next);return next;
}
