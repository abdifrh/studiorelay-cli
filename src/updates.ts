import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {configDirectory} from './config.js';
import {VERSION} from './version.js';
const registry='https://registry.npmjs.org/@studiorelay%2fcli/latest';
const valid=(value:unknown):value is string=>typeof value==='string'&&value.length<64&&/^\d+\.\d+\.\d+$/.test(value);
export function newer(latest:string,installed=VERSION){
 if(!valid(latest)||!valid(installed))return false;
 const a=latest.split('.').map(BigInt),b=installed.split('.').map(BigInt);
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;
}
export async function latestVersion(fetcher:typeof fetch=fetch,timeout=1500){
 const response=await fetcher(registry,{redirect:'error',signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw new Error('Registre npm indisponible.');
 const value=await response.json() as {version?:unknown};if(!valid(value.version))throw new Error('Version du registre invalide.');return value.version;
}
export async function automaticUpdateNotice(options:{directory?:string;now?:number;fetcher?:typeof fetch}={}){
 const directory=options.directory||configDirectory(),now=options.now??Date.now(),file=join(directory,'update-check.json');
 let latest:string|undefined;
 try{
  let cached:{checkedAt?:number;latest?:unknown}={};try{const value=JSON.parse(await readFile(file,'utf8'));if(value&&typeof value==='object'&&!Array.isArray(value))cached=value;}catch{}
  if(typeof cached.checkedAt==='number'&&cached.checkedAt<=now&&now-cached.checkedAt<86400000){if(valid(cached.latest))latest=cached.latest;}
  else{
   try{latest=await latestVersion(options.fetcher);}catch{}
   try{await mkdir(directory,{recursive:true,mode:0o700});const temp=file+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify({checkedAt:now,...(latest?{latest}:{})}),{mode:0o600});await rename(temp,file);}catch{}
  }
 }catch{return null;}
 return latest&&newer(latest)?'StudioRelay '+latest+' est disponible (installée : '+VERSION+'). Mise à jour : npm install -g @studiorelay/cli@latest':null;
}
