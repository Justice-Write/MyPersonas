import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../MyPersonas.Online_v0/cms-connector-ui.js',import.meta.url),'utf8');
function fixture(){
 const effects=[],pending=[],waiters=[];
 const dialog=()=>new Promise(resolve=>{pending.push(resolve);waiters.shift()?.()});
 const ctx=vm.createContext({window:{},session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/studio'},
  myAccounts:[{id:'account',provider:'wix',owner:'owner'}],myDrafts:[{id:'draft',account_id:'account',owner:'owner'}],myAccountConnections:[{ledger_id:'account',provider:'wix',provider_subject:'site-author',connection_state:'connected'}],
  document:{getElementById:()=>null,createElement:()=>({}),body:{appendChild:()=>{}}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  appConfirm:dialog,appPrompt:dialog,requireAal2ForSensitiveAction:async()=>true,toast:()=>{},esc:String,safeHttpUrl:()=>'',loadMine:async()=>{},renderStudio:()=>{},acctTab:'',
  providerPostAction:async(name,args)=>{effects.push({name,args:JSON.parse(JSON.stringify(args))});return {status:200,data:{}}},
 });
 vm.runInContext(source,ctx);
 return {ctx,effects,next:()=>pending.length?Promise.resolve():new Promise(r=>waiters.push(r)),answer:value=>pending.shift()(value),run:action=>action==='disconnect'?ctx.window.disconnectCmsAccount('wix','account'):ctx.window[action==='trash'?'trashCmsDraft':'finalizeCmsTrashCheckpoint']('draft','wix','provider-draft','site-author')};
}
for(const action of ['disconnect','trash','finalize']){
 test(`${action}: cancelled CMS dialog performs no operation`,async()=>{
  const f=fixture(),p=f.run(action);await f.next();assert.deepEqual(f.effects,[]);f.answer(action==='disconnect'?false:null);await p;assert.deepEqual(f.effects,[]);
 });
 for(const change of ['session.user.id="other"','renderEpoch++','location.hash="#/owner"','myAccountConnections[0].provider_subject="replacement"']){
  test(`${action}: changed context after first CMS dialog cancels the operation: ${change}`,async()=>{
   const f=fixture(),p=f.run(action);await f.next();vm.runInContext(change,f.ctx);f.answer(action==='disconnect'?true:'provider-draft');await p;assert.deepEqual(f.effects,[]);
  });
 }
 test(`${action}: changed owner during MFA cancels the CMS operation`,async()=>{
  const f=fixture();f.ctx.requireAal2ForSensitiveAction=async()=>{f.ctx.session.user.id='other';return true};
  const p=f.run(action);await f.next();f.answer(action==='disconnect'?true:'provider-draft');if(action!=='disconnect'){await f.next();f.answer('site-author')}await p;assert.deepEqual(f.effects,[]);
 });
 test(`${action}: unchanged inputs preserve the exact existing CMS operation`,async()=>{
  const f=fixture(),p=f.run(action);await f.next();f.answer(action==='disconnect'?true:'provider-draft');if(action!=='disconnect'){await f.next();f.answer('site-author')}await p;
  assert.deepEqual(f.effects,[action==='disconnect'?{name:'wix-oauth',args:{action:'disconnect',ledgerId:'account',confirmLocalDisconnect:true}}:{name:'wix-draft',args:{action:action==='trash'?'delete-draft':'finalize-trash-checkpoint',draftId:'draft',[action==='trash'?'confirmDelete':'confirmProviderTrash']:true,expectedProviderDraftId:'provider-draft',expectedTargetId:'site-author'}}]);
 });
}
for(const action of ['trash','finalize']){
 test(`${action}: changed draft during second confirmation is rejected`,async()=>{
  const f=fixture(),p=f.run(action);await f.next();f.answer('provider-draft');await f.next();f.ctx.myDrafts[0].account_id='replacement';f.answer('site-author');await p;assert.deepEqual(f.effects,[]);
 });
 test(`${action}: wrong exact target never invokes a provider or checkpoint`,async()=>{
  const f=fixture(),p=f.run(action);await f.next();f.answer('provider-draft');await f.next();f.answer('wrong-site');await p;assert.deepEqual(f.effects,[]);
 });
 test(`${action}: foreign owner or mismatched binding cannot open a confirmation`,async()=>{
  const f=fixture();f.ctx.myDrafts[0].owner='other';f.ctx.appPrompt=()=>{throw Error('must not prompt')};await f.run(action);assert.deepEqual(f.effects,[]);
 });
}
