import {mkdir,readFile,writeFile,rename,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
export interface Config {server:string;mediaRoot:string;profile:string;version:1}
export function configDirectory(){return process.env.STUDIORELAY_CONFIG_DIR || (process.platform==='win32'?join(process.env.APPDATA||homedir(),'StudioRelay'):process.platform==='darwin'?join(homedir(),'Library','Application Support','StudioRelay'):join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'studiorelay'));}
export function origin(value:string,allowLoopback=false){
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(allowLoopback&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new Error('Adresse HTTPS de StudioRelay requise, sans chemin, identifiants ni paramètres.');
 return url.origin;
}
export async function loadConfig():Promise<Config>{
 const value=JSON.parse(await readFile(join(configDirectory(),'config.json'),'utf8'));
 if(value.version!==1||typeof value.mediaRoot!=='string'||typeof value.profile!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(value.profile))throw new Error('Configuration invalide ; relancez studiorelay init.');
 value.server=origin(value.server,process.env.STUDIORELAY_ALLOW_LOOPBACK==='1');return value;
}
export async function saveConfig(server:string,mediaRoot:string,profile='default'){
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(profile))throw new Error('Nom de profil invalide.');
 const value:Config={version:1,server:origin(server,process.env.STUDIORELAY_ALLOW_LOOPBACK==='1'),mediaRoot:await realpath(resolve(mediaRoot)),profile};
 const dir=configDirectory();await mkdir(dir,{recursive:true,mode:0o700});
 const temp=join(dir,`config.${process.pid}.tmp`);await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,join(dir,'config.json'));return value;
}
