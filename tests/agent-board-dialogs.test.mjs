import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../MyPersonas.Online_v0/agent-board.js',import.meta.url),'utf8');
const hash='a'.repeat(64),id='00000000-0000-4000-8000-000000000001';
const actions={settings:'agentBoardSaveSettings()',approve:`agentBoardApprove('${id}')`,reject:`agentBoardReject('${id}')`,cancel:`agentBoardCancel('${id}')`,delete:`agentBoardDelete('${id}')`,run:`agentBoardRun('${id}','${hash}')`,budget:'agentBoardSaveBudget()'};
function fixture(){
 const effects=[],nodes=new Map();
 for(const [key,value] of Object.entries({agentBoardPersona:'persona',agentBoardDaily:'2',agentBoardTypes:'research',agentBudgetBackend:'backend',agentBudgetMode:'agent_board',agentBudgetDailyRequests:'1',agentBudgetMonthlyRequests:'2',agentBudgetDailyTokens:'10',agentBudgetMonthlyTokens:'20',agentBudgetConcurrency:'1',agentBudgetTtl:'60'}))nodes.set(key,{value});
 for(const key of ['agentBoardProposals','agentBoardExecution','agentBudgetEnabled'])nodes.set(key,{checked:true});
 let resolve,openedResolve;
 const opened=new Promise(r=>openedResolve=r),dialog=()=>{openedResolve();return new Promise(r=>resolve=r)};
 const ctx=vm.createContext({session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/agent-board'},myBackends:[],myPersonas:[],document:{getElementById:id=>nodes.get(id)},appConfirm:dialog,appPrompt:dialog,toast:()=>{},requireAal2ForSensitiveAction:async()=>true,
  sb:{rpc:async(name,args)=>{effects.push({name,args:JSON.parse(JSON.stringify(args))});return {data:null}},auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}}})}},
  CONFIG:{SUPABASE_URL:'https://synthetic.invalid'},fetch:async(url,args)=>{effects.push({name:'run',args:JSON.parse(args.body)});return {ok:true,json:async()=>({executed:true})}},
 });
 vm.runInContext(source,ctx);
 vm.runInContext(`agentBoardState.queue=[{id:'${id}',status:'approved',approved_review_hash:'${hash}',approved_review_payload:{text:'unchanged'},target_persona_name:'Persona',task_type:'research'}];agentBoardReviewItem=()=>({review_hash:'${hash}',review_payload:{text:'unchanged'}});agentBoardPaint=()=>{};renderAgentBoard=()=>{};agentBoardUnlockBudgets=()=>{};agentBoardIdempotencyKey=()=> 'synthetic-idempotency';`,ctx);
 return {ctx,nodes,effects,opened,answer:value=>resolve(value),run:action=>vm.runInContext(actions[action],ctx)};
}
for(const action of Object.keys(actions)){
 const answer=action==='reject'?'Reason':action==='delete'?'DELETE 00000000':true;
 test(`${action}: cancel while pending performs no RPC or run`,async()=>{
  const f=fixture(),p=f.run(action);await f.opened;assert.deepEqual(f.effects,[]);f.answer(action==='reject'||action==='delete'?null:false);await p;assert.deepEqual(f.effects,[]);
 });
 for(const change of ['session.user.id="other"','renderEpoch++','location.hash="#/owner"']){
  test(`${action}: ${change} cancels the delayed decision`,async()=>{
   const f=fixture(),p=f.run(action);await f.opened;vm.runInContext(change,f.ctx);f.answer(answer);await p;assert.deepEqual(f.effects,[]);
  });
 }
 test(`${action}: unchanged confirmation performs one existing operation`,async()=>{
  const f=fixture(),p=f.run(action);await f.opened;f.answer(answer);await p;assert.equal(f.effects.length,1);
 });
}
for(const action of ['approve','reject','cancel','delete','run']){
 test(`${action}: changed queue item invalidates confirmation`,async()=>{
  const f=fixture(),p=f.run(action);await f.opened;vm.runInContext('agentBoardState.queue[0].status="changed"',f.ctx);f.answer(action==='reject'?'Reason':action==='delete'?'DELETE 00000000':true);await p;assert.deepEqual(f.effects,[]);
 });
}
for(const [action,field] of [['settings','agentBoardDaily'],['budget','agentBudgetDailyTokens']]){
 test(`${action}: fields changed during confirmation are not applied`,async()=>{
  const f=fixture(),p=f.run(action);await f.opened;f.nodes.get(field).value='999';f.answer(true);await p;assert.deepEqual(f.effects,[]);
 });
 test(`${action}: owner changes during MFA cannot authorize the captured inputs`,async()=>{
  const f=fixture();f.ctx.requireAal2ForSensitiveAction=async()=>{f.ctx.session.user.id='other';return true};const p=f.run(action);await f.opened;f.answer(true);await p;assert.deepEqual(f.effects,[]);
 });
}
test('run rechecks the guard after fetching the bearer session',async()=>{
 const f=fixture();f.ctx.sb.auth.getSession=async()=>{vm.runInContext('agentBoardState.queue[0].approved_review_payload={changed:true}',f.ctx);return {data:{session:{user:{id:'owner'},access_token:'synthetic'}}}};
 const p=f.run('run');await f.opened;f.answer(true);await p;assert.deepEqual(f.effects,[]);
});
