import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync('MyPersonas.Online_v0/creative-media.js','utf8');
const ui = fs.readFileSync('MyPersonas.Online_v0/creative-workspace.js','utf8');
const owner='11111111-1111-4111-8111-111111111111', persona='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function core(){const ctx=vm.createContext({URL});vm.runInContext(source,ctx);return ctx.CreativeMedia;}
test('private import rejects foreign personas, missing rights and unknown tool labels',()=>{
 const c=core(),input={title:'Frame',source_tool:'davinci',rights_confirmed:true,persona_id:persona};
 assert.throws(()=>c.metadata(input,owner,[{id:persona,owner:'someone-else'}]),/owned persona/);
 assert.throws(()=>c.metadata({...input,persona_id:null,rights_confirmed:false},owner,[]),/right to store/);
 assert.throws(()=>c.metadata({...input,persona_id:null,source_tool:'certified-engine'},owner,[]),/source tool/);
 const result=c.metadata(input,owner,[{id:persona,owner}]);assert.equal(result.training_allowed,false);assert.equal(result.review_status,'unreviewed');
});
test('media validation bounds files and rejects active document types',()=>{
 const c=core();assert.equal(c.fileType({type:'video/mp4',size:100}).kind,'video');
 for(const file of [{type:'image/svg+xml',size:100},{type:'text/html',size:100},{type:'image/png',size:0},{type:'image/png',size:52428801}])assert.throws(()=>c.fileType(file));
 assert.doesNotThrow(()=>c.validateBytes('image/png',new Uint8Array([137,80,78,71,13,10,26,10]).buffer));
 assert.throws(()=>c.validateBytes('image/png',new TextEncoder().encode('<html>not a PNG</html>').buffer),/contents/);
});
test('provider references only accept the exact trusted HTTPS CDN',()=>{
 const c=core();assert.equal(c.providerUrl('https://cdn.openart.ai/result.png'),'https://cdn.openart.ai/result.png');
 for(const url of ['https://cdn.openart.ai.evil.test/a','https://cdn.openart.ai@evil.test/a','http://cdn.openart.ai/a','javascript:alert(1)','https://cdn.openart.ai:444/a'])assert.equal(c.providerUrl(url),'');
});
test('OpenArt catalog preserves model operations and supported modes without inventing fields',()=>{
 const c=core(),rows=c.modes({models:[{id:'m',displayName:'Model',modes:{image:[{mode:'edit',affordable:false}],video:[{mode:'animate'}],audio:[{mode:'speak'}]}}]});
 assert.equal(rows.length,2);assert.equal(rows[0].model,'m');assert.equal(rows[0].affordable,false);assert.equal(rows[1].mode,'animate');
 assert.equal(c.unpack({content:[{type:'text',text:'{"items":[]}'}]}).items.length,0);assert.throws(()=>c.unpack({content:[]}),/unsupported/);
});
test('library filters combine text, media, source and exact persona',()=>{
 const c=core();const rows=[{title:'Campaign cut',project:'Launch',kind:'video',source_tool:'davinci',persona_id:persona},{title:'Campaign image',kind:'image',source_tool:'openart'}];
 assert.equal(c.filter(rows,{query:'launch',kind:'video',source:'davinci',persona}).length,1);assert.equal(c.filter(rows,{persona:'other'}).length,0);
});
function context(){
 const nodes=new Map();const ctx=vm.createContext({URL,console,session:{user:{id:owner}},privateSessionReady:true,location:{hash:'#/create'},navigator:{onLine:true},document:{getElementById:id=>nodes.get(id)},ownerAppIsPersonaMode:()=>false});
 vm.runInContext(source+'\n'+ui,ctx);return {ctx,nodes};
}
test('late provider responses cannot render after owner or route changes',async()=>{
 const {ctx}=context();let resolve;ctx.sb={functions:{invoke:()=>new Promise(r=>resolve=r)}};
 const pending=vm.runInContext('creativeInvoke("openart-library",{action:"models"},creativeContext())',ctx);
 ctx.session={user:{id:'22222222-2222-4222-8222-222222222222'}};resolve({data:{models:[]}});
 await assert.rejects(pending,/workspace changed/);
});
test('quote completion is discarded after settings change',async()=>{
 const {ctx,nodes}=context();for(const [id,value] of [['creativeProject','0'],['creativeActor',persona],['creativeConsent','']])nodes.set(id,{value,checked:true});
 nodes.set('creativeQuote',{replaceChildren(){},innerHTML:''});nodes.set('creativeStatus',{textContent:''});
 ctx.myPersonas=[{id:persona,owner}];let resolve;ctx.sb={functions:{invoke:()=>new Promise(r=>resolve=r)}};
 vm.runInContext('creativeState.selectedMode={model:"m",mode:"text2image",media:"image"};creativeState.form={jsonSchema:{properties:{}}};creativeState.projects=[{id:"p",name:"Project",canGenerate:true}]',ctx);
 const pending=vm.runInContext('creativeQuote(creativeContext())',ctx);vm.runInContext('creativeClearQuote()',ctx);
 resolve({data:{job:{id:persona,quoted_credits:5}}});await pending;
 assert.equal(vm.runInContext('creativeState.quote',ctx),null);assert.match(nodes.get('creativeStatus').textContent,/Settings changed/);assert.equal(nodes.get('creativeQuote').innerHTML,'');
});
test('private routes and erasure are wired without caching owner media or bypassing draft restrictions',()=>{
 const html=fs.readFileSync('MyPersonas.Online_v0/index.html','utf8'), worker=fs.readFileSync('MyPersonas.Online_v0/service-worker.js','utf8');
 assert.match(html,/view==="create"\|\|view==="library"/);assert.match(html,/creative-workspace.js/);
 assert.doesNotMatch(worker,/"\.\/creative-workspace|"\.\/creative-media/);
 assert.match(fs.readFileSync('MyPersonas.Online_v0/persona-view.js','utf8'),/"create", "library", "studio"/);
 assert.match(fs.readFileSync('supabase/functions/delete-account/index.ts','utf8'),/bucket: "creative-private", prefix: normalizedOwner/);
 assert.match(fs.readFileSync('MyPersonas.Online_v0/mobile-owner-workflow.js','utf8'),/Mobile private drafts do not accept media plans/);
 assert.doesNotMatch(ui,/localStorage|indexedDB|caches\.open|service_role/);
});
