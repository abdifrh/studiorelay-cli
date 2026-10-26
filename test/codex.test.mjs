import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import spawn from 'cross-spawn';
import {installCodex,uninstallCodex,codexPaths} from '../dist/codex.js';
import {checkConnector} from '../dist/login.js';

test('Claude and Codex Skills share the same publication workflow',async()=>{
 const claude=await readFile(new URL('../skill/SKILL.md',import.meta.url),'utf8');
 const codex=await readFile(new URL('../skill/codex/SKILL.md',import.meta.url),'utf8');
 assert.equal(codex,claude.replace(/allowed-tools:\r?\n(?:  - .*\r?\n)+/,''));
});

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'sr-codex-')),options={skillsRoot:join(root,'skills')};
 const previous=process.env.STUDIORELAY_CONFIG_DIR;process.env.STUDIORELAY_CONFIG_DIR=join(root,'connector');
 const original=spawn.sync,entries=new Map([['other',{transport:{type:'stdio',command:'keep-me',args:[]}}]]),calls=[];
 spawn.sync=(binary,args)=>{
  assert.equal(binary,'codex');calls.push(args);
  if(args[1]==='get')return entries.has('studiorelay')?{status:0,stdout:JSON.stringify(entries.get('studiorelay'))}:{status:1,stderr:"Error: No MCP server named 'studiorelay' found."};
  if(args[1]==='add'){assert.equal(args[3],'--');entries.set('studiorelay',{transport:{type:'stdio',command:args[4],args:args.slice(5)}});}
  else if(args[1]==='remove')entries.delete('studiorelay');
  else assert.fail('Unexpected command');
  return {status:0,stdout:''};
 };
 t.after(async()=>{spawn.sync=original;if(previous===undefined)delete process.env.STUDIORELAY_CONFIG_DIR;else process.env.STUDIORELAY_CONFIG_DIR=previous;await rm(root,{recursive:true,force:true});});
 return {options,entries,calls,paths:codexPaths(options)};
}
test('Codex installation is idempotent, uses official CLI and preserves other entries',async t=>{
 const {options,entries,calls,paths}=await fixture(t);
 await installCodex(options);await installCodex(options);
 assert.equal(calls.filter(args=>args[1]==='add').length,1);
 const skill=await readFile(join(paths.skill,'SKILL.md'),'utf8');
 assert.match(skill,/name: studiorelay/);assert.doesNotMatch(skill,/allowed-tools:/);
 assert.ok(await readFile(join(paths.skill,'contracts/api-import.schema.json'),'utf8'));
 await uninstallCodex(options);
 assert.equal(entries.get('other').transport.command,'keep-me');assert.equal(entries.has('studiorelay'),false);
 await assert.rejects(readFile(join(paths.skill,'SKILL.md')));
});
test('Codex refuses conflicting MCP or custom Skill; uninstall preserves edited Skill',async t=>{
 const {options,entries,calls,paths}=await fixture(t);
 entries.set('studiorelay',{transport:{type:'stdio',command:'someone-else',args:[]}});
 await assert.rejects(installCodex(options),/existe déjà/);assert.equal(calls.filter(args=>args[1]==='add').length,0);
 entries.delete('studiorelay');await mkdir(paths.skill,{recursive:true});await writeFile(join(paths.skill,'SKILL.md'),'custom');
 await assert.rejects(installCodex(options),/modifié/);assert.equal(entries.has('studiorelay'),false);
 await rm(join(paths.skill,'SKILL.md'));await installCodex(options);
 await writeFile(join(paths.skill,'SKILL.md'),'edited');await assert.rejects(installCodex(options),/modifié/);
 const result=await uninstallCodex(options);assert.deepEqual(result.preserved,['SKILL.md']);
 assert.equal(await readFile(join(paths.skill,'SKILL.md'),'utf8'),'edited');
});
test('login preflight diagnoses disabled, missing client and old server before browser auth',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(checkConnector('https://example.invalid'),/Mettez le serveur à jour/);
 globalThis.fetch=async()=>Response.json({ready:false,code:'disabled'},{status:503});await assert.rejects(checkConnector('https://example.invalid'),/activation serveur/);
 globalThis.fetch=async()=>Response.json({ready:false,code:'client_missing'},{status:503});await assert.rejects(checkConnector('https://example.invalid'),/configure_claude_connector/);
 globalThis.fetch=async url=>{assert.equal(url.pathname,'/connector/status/');return Response.json({ready:true,code:'ready'});};await checkConnector('https://example.invalid');
});
