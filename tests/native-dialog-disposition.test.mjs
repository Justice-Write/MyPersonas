import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('docs/NATIVE-DIALOG-DISPOSITION-20261030.json'));
test('every baseline native call has a converted or explicit browser-gated disposition',()=>{
 assert.equal(manifest.groups.length,85);
 assert.equal(manifest.groups.reduce((n,g)=>n+g.calls,0),99);
 assert.equal(manifest.groups.filter(g=>g.disposition==='converted_guarded_async').reduce((n,g)=>n+g.calls,0),94);
 const expected={'index.html:mailboxUnsubscribe':3,'index.html:handleOAuthReturn':1,'platform-governance.js:governanceCopyBusinessReview':1},actual={};
 for(const file of [...new Set(manifest.groups.map(g=>g.file))]){
  const source=read(file),functions=[...source.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)];
  assert.doesNotMatch(source,/(?:window|globalThis|self)\s*\.\s*(?:confirm|prompt|alert)\s*\(/);
  for(const match of source.matchAll(/(?<![\w.])(?:confirm|prompt|alert)\s*\(/g)){
   const name=functions.filter(f=>f.index<match.index).at(-1)?.[1];
   const key=file.split('/').at(-1)+':'+name;actual[key]=(actual[key]||0)+1;
  }
 }
 assert.deepEqual(actual,expected);
});
test('install prompt remains a browser API rather than an application text prompt',()=>{
 const pwa=read('MyPersonas.Online_v0/pwa.js');assert.match(pwa,/await promptEvent\.prompt\(\)/);assert.doesNotMatch(pwa,/appPrompt\(/);
});
