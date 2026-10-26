import {createInterface} from 'node:readline';
import type {Readable,Writable} from 'node:stream';
import spawn from 'cross-spawn';

export function waitForEnter(input:Readable=process.stdin,output:Writable=process.stderr){
 return new Promise<void>((resolve,reject)=>{
  const terminal=createInterface({input,output});let confirmed=false;
  terminal.once('line',()=>{confirmed=true;terminal.close();resolve();});
  terminal.once('close',()=>{if(!confirmed)reject(new Error('Connexion annulée avant l’ouverture du navigateur.'));});
  terminal.once('SIGINT',()=>terminal.close());
  output.write('Appuyez sur ENTRÉE pour ouvrir le navigateur et vous connecter à StudioRelay. ');
 });
}
export function browserCommand(address:string,platform:NodeJS.Platform=process.platform){
 const url=new URL(address);if(!['https:','http:'].includes(url.protocol))throw new Error('Adresse de connexion invalide.');
 if(platform==='win32'){
  // Encode the PowerShell script so URL query parameters never become shell syntax.
  const script="Start-Process -FilePath '"+url.href.replace(/'/g,"''")+"' -ErrorAction Stop";
  return {command:'powershell.exe',args:['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]};
 }
 return {command:platform==='darwin'?'open':'xdg-open',args:[url.href]};
}
export function openLoginBrowser(address:string){
 const {command,args}=browserCommand(address);
 const fallback=()=>console.error('Ouverture automatique impossible. Ouvrez manuellement le lien affiché ci-dessus.');
 try{const child=spawn(command,args,{stdio:'ignore',windowsHide:true});child.once('error',fallback);child.once('exit',code=>{if(code!==0)fallback();});child.unref();}catch{fallback();}
}
