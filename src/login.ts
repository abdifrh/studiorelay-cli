import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {openLoginBrowser,waitForEnter} from './browser.js';
import {oauthRequest,withCredentialLock,type CredentialStore} from './credentials.js';
import type {Config} from './config.js';
export async function checkConnector(server:string){
 const response=await fetch(new URL('/connector/status/',server),{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(response.status===404)throw new Error('Le serveur StudioRelay ne propose pas encore le connecteur. Mettez le serveur à jour et activez-le avant de relancer login.');
 let status:{ready?:boolean;code?:string};try{status=await response.json() as typeof status;}catch{throw new Error('Diagnostic du connecteur indisponible. Vérifiez le domaine et le déploiement StudioRelay.');}
 if(!response.ok||status.ready!==true)throw new Error(status.code==='client_missing'?'Le client OAuth studiorelay-cli doit être enregistré sur le serveur : configure_claude_connector.':'Le connecteur StudioRelay attend son activation serveur. Consultez la section Studios & assistants du dashboard.');
}
export async function login(config:Config,store:CredentialStore,openBrowser=true){
 const interactive=Boolean(process.stdin.isTTY&&process.stderr.isTTY);
 if(openBrowser&&interactive)await waitForEnter();
 await checkConnector(config.server);
 const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');
 let receive!:(value:string)=>void,reject!:(error:Error)=>void;
 let boundHost='';
 const code=new Promise<string>((yes,no)=>{receive=yes;reject=no;});
 const server=createServer((request,response)=>{
  const url=new URL(request.url||'/', 'http://127.0.0.1');
  response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','text/plain; charset=utf-8');
  if(request.headers.host!==boundHost){response.writeHead(403).end();return;}
  if(request.method!=='GET'||url.pathname!=='/callback'){response.writeHead(404).end();return;}
  const actual=url.searchParams.get('state')||'';
  if(Buffer.byteLength(actual)!==Buffer.byteLength(state)||!timingSafeEqual(Buffer.from(actual),Buffer.from(state))){response.writeHead(400).end('État de connexion incorrect.');return;}
  const value=url.searchParams.get('code');
  if(!value||value.length>512){response.writeHead(400).end('Connexion refusée.');reject(new Error('Autorisation refusée dans le navigateur.'));return;}
  response.end('Connexion reçue. Vous pouvez revenir au terminal.');receive(value);
 });
 server.maxConnections=8;server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 await new Promise<void>((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',()=>yes());});
 const address=server.address();if(!address||typeof address==='string')throw new Error('Port local indisponible.');
 boundHost='127.0.0.1:'+address.port;
 const redirect='http://127.0.0.1:'+address.port+'/callback';
 const url=new URL('/connector/authorize/',config.server);url.search=new URLSearchParams({client_id:'studiorelay-cli',response_type:'code',redirect_uri:redirect,scope:'read import draft approve cancel read_history',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 const timeout=setTimeout(()=>reject(new Error('Connexion expirée après cinq minutes.')),300000);
 console.error('Autorisez la connexion dans votre navigateur : '+url.href);
 if(openBrowser&&interactive)openLoginBrowser(url.href);
 try{const received=await code;await withCredentialLock(async()=>{const next=await oauthRequest(config.server,'/connector/token/',{client_id:'studiorelay-cli',grant_type:'authorization_code',redirect_uri:redirect,code:received,code_verifier:verifier});if(!next)throw new Error('Réponse OAuth absente.');await store.set(next);});}
 finally{clearTimeout(timeout);server.closeAllConnections();server.close();}
}
export async function logout(config:Config,store:CredentialStore){
 return withCredentialLock(async()=>{const current=await store.get();let revoked=false;
  try{if(current?.kind==='oauth'){await oauthRequest(config.server,'/connector/revoke/',{client_id:'studiorelay-cli',token:current.refresh_token,token_type_hint:'refresh_token'});revoked=true;}}
  finally{await store.clear();}
  return {disconnected:true,revoked,message:revoked?'Session révoquée.':'Clé locale supprimée. Pour un ancien jeton privé, révoquez aussi la clé dans StudioRelay.'};
 });
}
