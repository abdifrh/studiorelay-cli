import spawn from 'cross-spawn';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const result=spawn.sync('npm',['pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8'});if(result.status!==0)throw new Error('npm pack dry-run failed');
const [pack]=JSON.parse(result.stdout);assert.ok(pack.unpackedSize<3*1024*1024,'Package must stay below 3 MiB');
const allowed=/^(dist\/|skill\/|contracts\/|README\.md$|LICENSE$|CHANGELOG\.md$|package\.json$)/;
const secrets=[/sr1_[a-f0-9]{32}_[A-Za-z0-9_-]{43}/,/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/,/postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/];
for(const file of pack.files){assert.ok(allowed.test(file.path),'Unexpected public file: '+file.path);assert.ok(!/(node_modules|\.env|\.sqlite|\.dump|backups)/.test(file.path));const text=await readFile(file.path,'utf8');for(const pattern of secrets)assert.ok(!pattern.test(text),'Potential secret in '+file.path);}
assert.ok(pack.files.some(f=>f.path==='skill/SKILL.md'));assert.ok(pack.files.some(f=>f.path==='skill/codex/SKILL.md'));assert.ok(pack.files.some(f=>f.path==='dist/codex.js'));assert.ok(pack.files.some(f=>f.path==='dist/cli.js'));console.log(JSON.stringify({safe:true,files:pack.files.length,unpackedBytes:pack.unpackedSize}));
