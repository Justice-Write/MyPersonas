import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../MyPersonas.Online_v0/platform-governance.js',import.meta.url),'utf8');
const actions={
 explain:['governanceExplainIntentionWithAi()',1],unpublish:['governanceUnpublish()',1],
 submitFeature:['governanceSubmitFeature("item")',1],withdrawFeature:['governanceWithdrawFeature("item")',1],deleteFeature:['governanceDeleteFeature("item")',1],
 issueInvite:['governanceIssueInvite("persona")',2],revokeInvites:['governanceRevokeInvites("persona")',1],
 submitExtension:['governanceSubmitExtension("item")',1],withdrawExtension:['governanceWithdrawExtension("item")',1],deleteExtension:['governanceDeleteExtension("item")',1],
 deleteFamily:['governanceDeleteFamilyRelationship("item","persona")',1],erasePii:['governanceEraseReviewRequestPii("item","persona")',1],
 deleteProduct:['governanceDeleteProduct("item","persona")',1],deleteOffer:['governanceDeleteOffer("item","persona")',1],
 publishedMutation:['governanceBusinessPublishedMutationCheck("published","Edit")',0],createBusiness:['governanceCreateBusinessDraft()',1],
 deleteMission:['governanceDeleteMissionItem("item","business","published")',1],unpublishBusiness:['governanceUnpublishBusiness("business")',1],
};
function fixture(auto=false){
 const effects=[],nodes=new Map([['govIntention',{value:'Build a page'}],['govIntentionBackend',{value:'backend'}],['govFriendMode',{value:'open'}]]);
 let answer,openedResolve;const opened=new Promise(r=>openedResolve=r);
 const dialog=()=>{openedResolve();return new Promise(r=>answer=r)};
 const ctx=vm.createContext({session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/review/persona'},myPersonas:[{id:'persona',name:'Persona'}],myBackends:[{id:'backend',name:'Backend'}],
  document:{getElementById:id=>nodes.get(id)},appConfirm:auto?async()=>true:dialog,appPrompt:auto?async()=> 'Business':dialog,
  requireAal2ForSensitiveAction:async()=>true,toast:()=>{},go:()=>{},loadMine:async()=>{},backendAgentReady:()=>true,
  callAI:async()=>{effects.push('callAI');return 'Synthetic reply'},sb:{rpc:async name=>{effects.push(name);return {data:true}}},
 });
 vm.runInContext(source,ctx);
 vm.runInContext('governanceState.personaId="persona";governanceState.featureRequests=[{id:"item",title:"Feature"}];governanceState.extensions=[{id:"item",title:"Extension"}];governanceState.affiliateProducts=[{id:"item",title:"Product"}];governanceBuildIntentionPlan=()=>({});governanceIntentionPlanText=()=>"Plan";governanceRenderIntentionPlan=()=>{};',ctx);
 return {ctx,effects,nodes,opened,answer:value=>answer(value),run:name=>vm.runInContext(actions[name][0],ctx)};
}
for(const [name,[,count]] of Object.entries(actions)){
 test(`${name}: cancelled governance input does not mutate or call a model`,async()=>{
  const f=fixture(),p=f.run(name);await f.opened;assert.deepEqual(f.effects,[]);f.answer(name==='createBusiness'?null:false);await p;assert.deepEqual(f.effects,[]);
 });
 for(const change of ['session.user.id="other"','governanceState.personaId="other-persona"']){
  test(`${name}: pending governance input cannot transfer to changed context: ${change}`,async()=>{
   const f=fixture(),p=f.run(name);await f.opened;vm.runInContext(change,f.ctx);f.answer(name==='createBusiness'?'Business':true);await p;assert.deepEqual(f.effects,[]);
  });
 }
 test(`${name}: unchanged accepted input retains existing operations`,async()=>{
  const f=fixture(true);await f.run(name);assert.equal(f.effects.length,count);
 });
}
for(const name of ['submitFeature','deleteExtension','erasePii','publishedMutation','deleteMission','unpublishBusiness']){
 test(`${name}: changed owner during MFA cancels mutation`,async()=>{
  const f=fixture(true);f.ctx.requireAal2ForSensitiveAction=async()=>{f.ctx.session.user.id='other';return true};await f.run(name);assert.deepEqual(f.effects,[]);
 });
}
test('changed AI model selection while confirming cannot send the captured plan',async()=>{
 const f=fixture(),p=f.run('explain');await f.opened;f.nodes.get('govIntentionBackend').value='other';f.answer(true);await p;assert.deepEqual(f.effects,[]);
});
test('changed feature details invalidate the exact request confirmation',async()=>{
 const f=fixture(),p=f.run('submitFeature');await f.opened;vm.runInContext('governanceState.featureRequests[0].title="Replacement"',f.ctx);f.answer(true);await p;assert.deepEqual(f.effects,[]);
});
