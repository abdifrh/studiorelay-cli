import test from 'node:test';
import assert from 'node:assert/strict';
import {createMcpServer} from '../dist/mcp.js';
import {VERSION} from '../dist/version.js';
import {readFile} from 'node:fs/promises';
test('package version and binary are consistent',async()=>{const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(p.version,VERSION);assert.ok((await readFile(new URL('../dist/cli.js',import.meta.url),'utf8')).startsWith('#!/usr/bin/env node'));});
test('MCP creates one local server without performing network mutations',()=>{let calls=0;const client=new Proxy({},{get(){calls++;return ()=>{throw new Error('unexpected request')}}});const server=createMcpServer(client);assert.ok(server);assert.equal(calls,0);});

import {Client,InMemoryTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('MCP protocol keeps review proof internal and enforces automatic mode',async t=>{
 let automatic=true,approvals=0;
 const fake={identity:async()=>({integration_id:'studio',auto_approve:automatic,permissions:['read','approve']}),review:async()=>({batch_id:'00000000-0000-4000-8000-000000000001',can_approve:true,revision:'revision',review_token:'INTERNAL_PROOF_NEVER_FOR_MODEL',expires_in_seconds:1800,destinations:[]}),approve:async(id,review,key)=>{assert.equal(review.review_token,'INTERNAL_PROOF_NEVER_FOR_MODEL');approvals++;return {committed:true}}};
 const server=createMcpServer(fake),client=new Client({name:'test',version:'1'}),[left,right]=InMemoryTransport.createLinkedPair();
 await server.connect(right);await client.connect(left);assert.match(client.getInstructions(),/identity puis list_accounts/);t.after(async()=>{await client.close();await server.close()});
 const tools=await client.listTools();assert.ok(tools.tools.some(tool=>tool.name==='upload_video'));assert.ok(tools.tools.some(tool=>tool.name==='cancel_publication'));
 const result=await client.callTool({name:'review_batch',arguments:{batch_id:'00000000-0000-4000-8000-000000000001'}});
 assert.ok(!JSON.stringify(result).includes('INTERNAL_PROOF_NEVER_FOR_MODEL'));
 const handle=JSON.parse(result.content[0].text).review_handle;
 automatic=false;const blocked=await client.callTool({name:'approve_batch',arguments:{review_handle:handle}});assert.equal(blocked.isError,true);assert.equal(approvals,0);
 automatic=true;const approved=await client.callTool({name:'approve_batch',arguments:{review_handle:handle}});assert.ok(!approved.isError);assert.equal(approvals,1);
});
test('stdio process exposes protocol without session credentials or stdout noise',async t=>{
 const root=await mkdtemp(join(tmpdir(),'sr-stdio-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'config.json'),JSON.stringify({version:1,server:'https://example.invalid',mediaRoot:root,profile:'test'}));
 const client=new Client({name:'test',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/cli.js',import.meta.url)),'mcp','--global'],env:{...process.env,STUDIORELAY_CONFIG_DIR:root},stderr:'pipe'});
 t.after(()=>client.close());await client.connect(transport);const tools=await client.listTools();assert.ok(tools.tools.length>=14);
});
