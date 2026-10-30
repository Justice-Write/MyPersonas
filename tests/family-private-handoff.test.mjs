import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const persona='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const asset={id,owner,persona_id:persona,title:'Synthetic exported frame',project:'Demo',alt_text:'A geometric test card.',notes:'',source_tool:'soul_concept'};
const roster=[{id:persona,owner,name:'Demo persona',handle:'demo.synthetic'}];
const core=fs.readFileSync('MyPersonas.Online_v0/creative-media.js','utf8');
const ui=fs.readFileSync('MyPersonas.Online_v0/creative-workspace.js','utf8');
function setup(){
 const nodes=new Map([['creativeEdit',{dataset:{assetId:id},fields:{...asset}}],['creativeStatus',{textContent:''}]]);
 const calls=[];
 const c=vm.createContext({URL,session:{user:{id:owner}},privateSessionReady:true,location:{hash:'#/library'},navigator:{onLine:true},
   myPersonas:structuredClone(roster),document:{getElementById:key=>nodes.get(key)},
   FormData:class {constructor(form){this.form=form} *[Symbol.iterator](){yield* Object.entries(this.form.fields)}},
   ownerAppIsPersonaMode:()=>false,go:route=>calls.push(['go',route]),
   ownerAppOpenPrivateDraft:target=>{calls.push(['draft',target]);nodes.set('ownerPrivateDraftModal',{});nodes.set('ownerMobileDraftGuidance',{value:''})}});
 vm.runInContext(core+'\n'+ui,c);
 c.fixtureAsset=structuredClone(asset);vm.runInContext('creativeState.assets=[fixtureAsset]; var opened=creativeContext()',c);
 return {c,nodes,calls,run:()=>vm.runInContext(`creativeContinueAsset('${id}',opened,null,'draft')`,c)};
}
test('Soulular uses deployed source enum and reference-only handoff with no authority',()=>{
 const {c}=setup();const p=c.CreativeMedia.handoff(asset,owner,roster,asset);
 assert.equal(c.CreativeMedia.sourceLabel('soul_concept'),'Soulular / Soul Concept');
 assert.equal(p.personaId,persona);assert.equal(p.pageRoute,'p/demo.synthetic');
 assert.match(p.guidance,/not attached or approved/);assert.match(p.guidance,/Library ID:/);
 assert.equal(p.publishing_enabled,false);assert.equal(p.training_allowed,false);assert.equal(p.media_plan,undefined);
});
test('foreign asset/persona, missing assignment and unsaved edits cannot continue',()=>{
 const {c}=setup(),h=c.CreativeMedia.handoff;
 assert.throws(()=>h({...asset,owner:other},owner,roster,asset),/own private/);
 assert.throws(()=>h(asset,owner,[{...roster[0],owner:other}],asset),/owned persona/);
 assert.throws(()=>h({...asset,persona_id:null},owner,roster,asset),/owned persona/);
 for(const key of ['title','persona_id','project','alt_text','notes']) assert.throws(()=>h(asset,owner,roster,{...asset,[key]:'changed'}),/Save your/);
});
test('production click opens exact owned draft without a write or media attachment',async()=>{
 const {run,calls,nodes}=setup();await run();assert.deepEqual(calls,[['draft',persona]]);
 assert.match(nodes.get('ownerMobileDraftGuidance').value,/Soulular \/ Soul Concept/);
});
test('production click refuses a stale owner, route, workspace or persona-mode view',async()=>{
 for(const mutation of [c=>c.session={user:{id:other}},c=>c.location.hash='#/create',c=>vm.runInContext('creativeReset()',c),c=>c.ownerAppIsPersonaMode=()=>true]){
   const s=setup();mutation(s.c);try{await s.run()}catch{}assert.equal(s.calls.length,0);
 }
});
test('production click refuses unsaved persona/name and never replaces an existing draft',async()=>{
 for(const mutate of [s=>s.nodes.get('creativeEdit').fields.persona_id=other,s=>s.nodes.get('creativeEdit').fields.title='Changed',s=>s.nodes.set('ownerPrivateDraftModal',{}),s=>s.nodes.get('creativeEdit').dataset.assetId='another-asset']){
   const s=setup();mutate(s);await s.run();assert.equal(s.calls.length,0);assert.ok(s.nodes.get('creativeStatus').textContent);
 }
});
test('AliaSpaces continuation only navigates to an owned saved handle',async()=>{
 const s=setup();await vm.runInContext(`creativeContinueAsset('${id}',opened,null,'page')`,s.c);
 assert.deepEqual(s.calls,[['go','p/demo.synthetic']]);
 for(const handle of ['', 'https://evil.test','../admin','demo?token=secret']){
   const x=setup();x.c.myPersonas[0].handle=handle;await vm.runInContext(`creativeContinueAsset('${id}',opened,null,'page')`,x.c);
   assert.equal(x.calls.length,0);assert.match(x.nodes.get('creativeStatus').textContent,/no saved AliaSpaces handle/);
 }
});

test('expired or signed-out session reports a safe refusal without an unhandled rejected click',async()=>{
 for(const mutate of [s=>s.c.session=null,s=>s.c.privateSessionReady=false]){
  const s=setup();mutate(s);await assert.doesNotReject(s.run());assert.equal(s.calls.length,0);assert.match(s.nodes.get('creativeStatus').textContent,/Sign in and complete account security/);
 }
});

test('reference handoff excludes stored private paths, provider URLs and asset bytes',()=>{
 const {c}=setup(),input={...asset,storage_path:'PRIVATE_STORAGE_SENTINEL',source_url:'https://provider.example/PRIVATE_URL_SENTINEL',bytes:'PRIVATE_BYTES_SENTINEL',credentials:'PRIVATE_CREDENTIAL_SENTINEL'};
 const plan=c.CreativeMedia.handoff(input,owner,roster,asset),serialized=JSON.stringify(plan);
 assert.doesNotMatch(serialized,/PRIVATE_(?:STORAGE|URL|BYTES|CREDENTIAL)_SENTINEL/);assert.equal(plan.media_plan,undefined);assert.equal(plan.training_allowed,false);assert.equal(plan.publishing_enabled,false);
});
