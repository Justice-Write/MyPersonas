import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('../MyPersonas.Online_v0/index.html',import.meta.url),'utf8');
function extract(name){
 const start=html.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,name);
 const rest=html.slice(start),next=rest.slice(1).search(/^(?:async )?function \w+\(/m);
 return rest.slice(0,next<0?undefined:next+1);
}
const guard=html.slice(html.indexOf('function ownerWorkflowDialogs(){'),html.indexOf('const PERSONA_FIELD_GUIDES='));
const actions={post:'deletePost("item")',group:'deleteGroup("item")',draft:'deleteDraft("item")',fan:'deleteFanConversation("item")',snippet:'deletePageBuilderSnippet("item")',album:'deleteAlbum("item")',task:'deleteTask("item")',composerDelete:'composerDelete("item")',unschedule:'composerUnschedule("item")',manualPosted:'markManualDraftPosted("item")',saveSnippet:'savePageBuilderSnippet()',widget:'addPageBuilderWidget("text")'};
function fixture(auto=false){
 const effects=[],fields=[{id:'field',value:'Original'}],nodes=new Map();
 let answer,openedResolve;const opened=new Promise(r=>openedResolve=r),dialog=()=>{openedResolve();return new Promise(r=>answer=r)};
 const ctx=vm.createContext({session:{user:{id:'owner'}},renderEpoch:1,authLoadGeneration:1,location:{hash:'#/owner'},
  myPersonas:[{id:'persona'}],myDrafts:[{id:'item',body:'Original'}],myBackends:[],myTasks:[],myAccounts:[],myAccountConnections:[],myAgentSettings:{},myChatWorkspaces:[],
  ownerAppState:{viewMode:'overview',selectedPersonaId:'persona',perspectiveGeneration:1},editId:'persona',editPageLayout:{widgets:[]},editPageSnippets:[],pageState:{p:{id:'persona'}},autoTab:'',
  composerPreviewProofs:new Map(),crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},normalizePersonaPageLayout:x=>x,
  document:{querySelectorAll:()=>fields,getElementById:id=>nodes.get(id)||{value:'',remove(){}}},
  appConfirm:auto?async()=>true:dialog,appPrompt:auto?async()=> 'Synthetic text':dialog,
  sb:{rpc:async(name,args)=>{effects.push({name,args:JSON.parse(JSON.stringify(args))});return {data:true}}},
  requireAal2ForSensitiveAction:async()=>true,toast:()=>{},go:()=>{},loadMine:async()=>{},loadGroups:async()=>{},loadEditAlbums:async()=>{},reloadPageBuilderSnippets:async()=>{},renderPageBuilder:()=>{},composerRefresh:()=>{},renderStudio:()=>{},
 });
 vm.runInContext(guard+Object.values(actions).map(call=>extract(call.slice(0,call.indexOf('(')))).join('\n'),ctx);
 return {ctx,fields,nodes,effects,opened,answer:value=>answer(value),run:action=>vm.runInContext(actions[action],ctx)};
}
for(const name of Object.keys(actions)){
 test(`${name}: delayed owner dialog sends no operation before confirmation`,async()=>{
  const f=fixture(),p=f.run(name);await f.opened;assert.deepEqual(f.effects,[]);f.answer(name==='saveSnippet'||name==='widget'?null:false);await p;assert.deepEqual(f.effects,[]);assert.equal(f.ctx.editPageLayout.widgets.length,0);
 });
 for(const change of ['session.user.id="other"','authLoadGeneration++','myDrafts[0].body="Changed"','ownerAppState.perspectiveGeneration++']){
  test(`${name}: stale owner/context cancels pending input: ${change}`,async()=>{
   const f=fixture(),p=f.run(name);await f.opened;vm.runInContext(change,f.ctx);f.answer(name==='saveSnippet'||name==='widget'?'Title':true);await p;assert.deepEqual(f.effects,[]);assert.equal(f.ctx.editPageLayout.widgets.length,0);
  });
 }
 test(`${name}: unchanged confirmation retains the existing action`,async()=>{
  const f=fixture(true);await f.run(name);assert.equal(f.effects.length,name==='widget'?0:1);if(name==='widget')assert.equal(f.ctx.editPageLayout.widgets.length,1);
 });
}
test('a changed form cancels the exact pending draft operation',async()=>{
 const f=fixture(),p=f.run('draft');await f.opened;f.fields[0].value='Replaced';f.answer(true);await p;assert.deepEqual(f.effects,[]);
});
test('MFA cannot transfer a pending task deletion to another owner',async()=>{
 const f=fixture(true);f.ctx.requireAal2ForSensitiveAction=async()=>{f.ctx.session.user.id='other';return true};await f.run('task');assert.deepEqual(f.effects,[]);
});

const helpers=['providerPostAction','mailboxCall','gmailOAuthAction','twitterOAuthAction','redditOAuthAction','youtubeOAuthAction','tiktokOAuthAction','discordOAuthAction','twitchOAuthAction','patreonOAuthAction','metaOAuthAction'];
for(const name of helpers){
 for(const changed of ['owner','route','epoch','returned-owner']){
  test(`${name}: ${changed} changed during session lookup cannot send an HTTP request`,async()=>{
   let finish,calls=0;const ctx=vm.createContext({session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/owner'},sb:{auth:{getSession:()=>new Promise(r=>finish=r)}},fetch:async()=>{calls++;throw Error('must not send')}});
   vm.runInContext(extract(name),ctx);const p=vm.runInContext(`${name}('synthetic')`,ctx);
   if(changed==='owner')ctx.session.user.id='other';if(changed==='route')ctx.location.hash='#/elsewhere';if(changed==='epoch')ctx.renderEpoch++;
   finish({data:{session:{user:{id:changed==='returned-owner'?'other':'owner'},access_token:'synthetic'}}});
   if(name==='mailboxCall')await assert.rejects(p,/owner changed/);else assert.match((await p).error,/owner changed/);assert.equal(calls,0);
  });
 }
 test(`${name}: same-owner lookup preserves the existing endpoint request`,async()=>{
  const calls=[];const ctx=vm.createContext({session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/owner'},CONFIG:{SUPABASE_URL:'https://synthetic.invalid'},sb:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}}})}},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({})}}});
  vm.runInContext(extract(name),ctx);await vm.runInContext(`${name}('synthetic',{})`,ctx);assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic');
 });
}
