import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import spawn from 'cross-spawn';
import {installClaude,uninstallClaude,claudePaths} from '../dist/claude.js';
test('install twice and uninstall only owned files without touching other MCP entries',async t=>{
 const root=await mkdtemp(join(tmpdir(),'sr-claude-'));process.env.CLAUDE_CONFIG_DIR=join(root,'claude');process.env.STUDIORELAY_CONFIG_DIR=join(root,'connector');await mkdir(process.env.CLAUDE_CONFIG_DIR);
 const file=claudePaths().configuration,original=spawn.sync;let adds=0,removes=0;
 await writeFile(file,JSON.stringify({mcpServers:{other:{command:'keep-me'}}}));
 spawn.sync=(_command,args)=>{const value=JSON.parse(readFileSync(file,'utf8'));if(args[1]==='add'){adds++;const n=args.indexOf('--');value.mcpServers.studiorelay={command:args[n+1],args:args.slice(n+2)};}else{removes++;delete value.mcpServers.studiorelay;}writeFileSync(file,JSON.stringify(value));return {status:0};};
 t.after(async()=>{spawn.sync=original;delete process.env.CLAUDE_CONFIG_DIR;await rm(root,{recursive:true,force:true});});
 await installClaude();await installClaude();assert.equal(adds,1);assert.ok(await readFile(join(claudePaths().skill,'contracts','api-import.schema.json'),'utf8'));
 await uninstallClaude();assert.equal(removes,1);const result=JSON.parse(await readFile(file,'utf8'));assert.equal(result.mcpServers.other.command,'keep-me');await assert.rejects(readFile(join(claudePaths().skill,'SKILL.md')));
});
test('custom skill is never overwritten',async t=>{
 const root=await mkdtemp(join(tmpdir(),'sr-custom-'));process.env.CLAUDE_CONFIG_DIR=join(root,'claude');process.env.STUDIORELAY_CONFIG_DIR=join(root,'connector');const paths=claudePaths();await mkdir(paths.skill,{recursive:true});await writeFile(join(paths.skill,'SKILL.md'),'human version');t.after(async()=>{delete process.env.CLAUDE_CONFIG_DIR;await rm(root,{recursive:true,force:true});});await assert.rejects(installClaude(),/modifié/);assert.equal(await readFile(join(paths.skill,'SKILL.md'),'utf8'),'human version');
});
