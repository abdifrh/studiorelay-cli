import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveStudioConfig,loadConfig,bindStudio,saveConfig} from '../dist/config.js';
import {StudioRelayClient} from '../dist/client.js';
import {projectHost} from '../dist/project-host.js';
const a={integration_id:'00000000-0000-4000-8000-000000000001',brand:{id:1,slug:'first'}};
const b={integration_id:'00000000-0000-4000-8000-000000000002',brand:{id:2,slug:'second'}};
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'sr-studios-'));const old=process.env.STUDIORELAY_CONFIG_DIR;process.env.STUDIORELAY_CONFIG_DIR=join(root,'global');await mkdir(join(root,'one'));await mkdir(join(root,'two'));t.after(async()=>{if(old===undefined)delete process.env.STUDIORELAY_CONFIG_DIR;else process.env.STUDIORELAY_CONFIG_DIR=old;await rm(root,{recursive:true,force:true});});return root;}
function client(config,identity,calls=[]){return new StudioRelayClient(config,{async get(){return {kind:'legacy',token:'fake-test-only'}}},async(url,options)=>{calls.push({url,method:options.method});return Response.json({data:url.endsWith('/identity/')?identity:{count:0,results:[]}})});}

test('two studios preserve global config, credentials namespace and immutable running contexts',async t=>{
 const root=await fixture(t);await saveConfig('https://example.invalid',root,'legacy');const old=await readFile(join(root,'global','config.json'),'utf8');
 const first=await bindStudio(await saveStudioConfig('https://example.invalid',join(root,'one')),a);
 const second=await bindStudio(await saveStudioConfig('https://example.invalid',join(root,'two')),b);
 assert.notEqual(first.profile,second.profile);assert.equal(await readFile(join(root,'global','config.json'),'utf8'),old);
 assert.equal((await loadConfig({studio:join(root,'one')})).binding.brandSlug,'first');
 assert.equal((await loadConfig({studio:join(root,'two')})).binding.brandSlug,'second');
 const results=await Promise.all([client(first,a).accounts(),client(second,b).accounts()]);assert.equal(results.length,2);
 await assert.rejects(saveStudioConfig('https://example.invalid',join(root,'one'),'different'),/conservée/);
});

test('wrong session or integration is rejected before accounts or mutation',async t=>{
 const root=await fixture(t),config=await bindStudio(await saveStudioConfig('https://example.invalid',join(root,'one'),'studio-one','first'),a),calls=[];
 await assert.rejects(client(config,b,calls).accounts(),/différente|autre/);
 await assert.rejects(client(config,b,calls).request('/api/v1/batches/','POST','{}'),/différente|autre/);
 assert.ok(calls.every(c=>c.url.endsWith('/identity/')));
 await assert.rejects(bindStudio(config,{...a,integration_id:b.integration_id}),/autre/);
 const before=await readFile(config.localFile,'utf8');await assert.rejects(bindStudio(config,b));assert.equal(await readFile(config.localFile,'utf8'),before);
});

test('unbound or modified studio cannot mutate and missing local config never falls back when required',async t=>{
 const root=await fixture(t);await saveConfig('https://example.invalid',root,'legacy');
 await assert.rejects(loadConfig({studio:join(root,'two'),requireLocal:true}),/Aucun studio/);
 const config=await saveStudioConfig('https://example.invalid',join(root,'one'));const calls=[];
 await assert.rejects(client(config,a,calls).accounts(),/non lié/);assert.equal(calls.length,0);
 const bound=await bindStudio(config,a);await writeFile(bound.localFile,'{invalid');await assert.rejects(client(bound,a,calls).accounts());assert.equal(calls.length,0);
 await assert.rejects(loadConfig({studio:join(root,'one')}));
});

for(const host of ['claude','codex'])test(`${host} project MCP pins root, preserves unrelated settings and detects changes`,async t=>{
 const root=await fixture(t),config=await bindStudio(await saveStudioConfig('https://example.invalid',join(root,'one')),a);
 const file=host==='claude'?join(config.mediaRoot,'.mcp.json'):join(config.mediaRoot,'.codex','config.toml');await mkdir(join(config.mediaRoot,'.codex'));
 const original=host==='claude'?JSON.stringify({mcpServers:{other:{command:'keep'}}}):'model = "keep"\n';await writeFile(file,original);
 await projectHost(config,host);await projectHost(config,host);const text=await readFile(file,'utf8');assert.match(text,/--studio/);assert.ok(text.includes(host==='claude'?'other':'model = "keep"'));
 assert.equal(JSON.stringify(config).includes('access_token'),false);
 await projectHost(config,host,true);const after=await readFile(file,'utf8');assert.ok(after.includes('keep'));assert.ok(!after.includes('--studio'));
 await projectHost(config,host);await writeFile(file,(await readFile(file,'utf8')).replace('--studio','--modified'));
 await assert.rejects(projectHost(config,host,true),/conservée|conservé/);
});

test('project installer refuses unmanaged entries without modifying them',async t=>{
 const root=await fixture(t),config=await bindStudio(await saveStudioConfig('https://example.invalid',join(root,'one')),a);
 const file=join(config.mediaRoot,'.mcp.json'),text=JSON.stringify({mcpServers:{studiorelay:{command:'custom'}}});await writeFile(file,text);await assert.rejects(projectHost(config,'claude'),/conservée/);assert.equal(await readFile(file,'utf8'),text);
});


test('nearest local studio wins in subfolders and malformed local config never uses global credentials',async t=>{
 const root=await fixture(t),before=process.cwd();
 await saveConfig('https://example.invalid',root,'legacy');await saveStudioConfig('https://example.invalid',join(root,'one'),'named');
 assert.equal((await saveStudioConfig('https://example.invalid',join(root,'one'))).profile,'named');
 await mkdir(join(root,'one','renders'));try{process.chdir(join(root,'one','renders'));assert.equal((await loadConfig()).profile,'named');
 await writeFile(join(root,'one','.studiorelay','config.json'),'invalid');await assert.rejects(loadConfig());}finally{process.chdir(before);}
});

test('new studio expected brand rejects the first incorrect authorization',async t=>{
 const root=await fixture(t),config=await saveStudioConfig('https://example.invalid',join(root,'one'),'first','first');
 await assert.rejects(bindStudio(config,b),/différente/);assert.equal(JSON.parse(await readFile(config.localFile,'utf8')).binding,undefined);
});
