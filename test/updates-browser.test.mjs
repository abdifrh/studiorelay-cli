import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {automaticUpdateNotice,newer,latestVersion} from '../dist/updates.js';
import {waitForEnter,browserCommand} from '../dist/browser.js';

test('stable versions compare numerically, without downgrade or untrusted messages',()=>{
 assert.equal(newer('0.10.0','0.2.1'),true);assert.equal(newer('0.2.1','0.2.1'),false);
 assert.equal(newer('0.2.0','0.2.1'),false);assert.equal(newer('1.0.0-beta','0.2.1'),false);
 assert.equal(newer('1.0.0\nrun evil','0.2.1'),false);
});
test('update checks cache success and failures for 24 hours and recover corrupt cache',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'sr-update-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.match(String(url),/^https:\/\/registry.npmjs.org\//);assert.equal(options.redirect,'error');return Response.json({version:'9.0.0'});};
 const first=await automaticUpdateNotice({directory,now:1000,fetcher});assert.match(first,/npm install -g @studiorelay\/cli@latest/);
 assert.equal(await automaticUpdateNotice({directory,now:2000,fetcher}),first);assert.equal(calls,1);
 await automaticUpdateNotice({directory,now:86402000,fetcher});assert.equal(calls,2);
 await writeFile(join(directory,'update-check.json'),'null');
 await automaticUpdateNotice({directory,now:86403000,fetcher});assert.equal(calls,3);
 const offline=async()=>{calls++;throw new Error('offline');};
 assert.equal(await automaticUpdateNotice({directory,now:172805000,fetcher:offline}),null);
 assert.equal(await automaticUpdateNotice({directory,now:172806000,fetcher:offline}),null);assert.equal(calls,4);
 assert.deepEqual(Object.keys(JSON.parse(await readFile(join(directory,'update-check.json'),'utf8'))),['checkedAt']);
});
test('explicit checks reject invalid registry data',async()=>{
 await assert.rejects(latestVersion(async()=>Response.json({version:'run something'})),/Version du registre invalide/);
 await assert.rejects(latestVersion(async()=>new Response('',{status:503})),/Registre npm indisponible/);
});
test('Enter is required before login proceeds; EOF cancels',async()=>{
 const input=new PassThrough(),output=new PassThrough();let text='';output.on('data',value=>text+=value);let ready=false;
 const waiting=waitForEnter(input,output).then(()=>{ready=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);assert.match(text,/ENTRÉE/);
 input.write('\n');await waiting;assert.equal(ready,true);
 const closed=new PassThrough();const cancelled=waitForEnter(closed,new PassThrough());closed.end();await assert.rejects(cancelled,/Connexion annulée/);
});
test('Windows browser opening uses an encoded URI, never explorer or cmd',()=>{
 const url='https://example.invalid/authorize/?state=abc&scope=read+draft';
 const command=browserCommand(url,'win32');assert.equal(command.command,'powershell.exe');assert.ok(command.args.includes('-NoProfile'));
 assert.equal(Buffer.from(command.args.at(-1),'base64').toString('utf16le'),"Start-Process -FilePath '"+url+"' -ErrorAction Stop");
 const quoted=browserCommand("https://example.invalid/?q=';malicious",'win32');
 assert.ok(Buffer.from(quoted.args.at(-1),'base64').toString('utf16le').includes("q=%27;malicious' -ErrorAction Stop"));
 assert.equal(browserCommand(url,'darwin').command,'open');assert.equal(browserCommand(url,'linux').command,'xdg-open');
 assert.throws(()=>browserCommand('file:///C:/not-a-web-url','win32'));
});
