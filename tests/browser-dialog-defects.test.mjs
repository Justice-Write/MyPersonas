import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../MyPersonas.Online_v0/index.html',import.meta.url),'utf8');
const governance=readFileSync(new URL('../MyPersonas.Online_v0/platform-governance.js',import.meta.url),'utf8');
function extract(source,name){const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0);const rest=source.slice(start),end=rest.slice(1).search(/^(?:async )?function \w+\(/m);return rest.slice(0,end<0?undefined:end+1);}
for(const mode of ['success','denied','cancelled','unavailable','throws'])test(`clipboard ${mode} settles without unhandled rejection`,async()=>{
 const notices=[],writes=[];const ctx=vm.createContext({navigator:{clipboard:mode==='unavailable'?undefined:{writeText:text=>{writes.push(text);if(mode==='throws')throw Error('synthetic');return mode==='success'?Promise.resolve():Promise.reject(Error(mode));}}},toast:text=>notices.push(text)});
 vm.runInContext(extract(html,'copyText'),ctx);assert.equal(await ctx.copyText('synthetic packet'),mode==='success');assert.equal(writes.length,mode==='unavailable'?0:1);assert.match(notices[0],mode==='success'?/Copied/:/failed or was cancelled/);
});
const destinations=[
 ['https', {kind:'https',url:'https://synthetic.invalid/unsubscribe#fragment',hostname:'synthetic.invalid'}, 'https://synthetic.invalid/unsubscribe'],
 ['mailto', {kind:'mailto',url:'mailto:unsubscribe@synthetic.invalid',hostname:'synthetic.invalid'}, 'mailto:unsubscribe%40synthetic.invalid'],
 ['http rejected', {kind:'https',url:'http://synthetic.invalid/'}, null],
 ['credentials rejected', {kind:'https',url:'https://user:password@synthetic.invalid/'}, null],
 ['port rejected', {kind:'https',url:'https://synthetic.invalid:444/'}, null],
 ['hostname mismatch rejected', {kind:'https',url:'https://synthetic.invalid/',hostname:'other.invalid'}, null],
 ['mail body rejected', {kind:'mailto',url:'mailto:unsubscribe@synthetic.invalid?body=send'}, null],
 ['mail fragment rejected', {kind:'mailto',url:'mailto:unsubscribe@synthetic.invalid#fragment'}, null],
 ['mail encoded newline rejected', {kind:'mailto',url:'mailto:unsubscribe%0A@synthetic.invalid'}, null],
 ['mail hostname mismatch rejected', {kind:'mailto',url:'mailto:unsubscribe@synthetic.invalid',hostname:'other.invalid'}, null],
 ['unsupported target rejected', {kind:'javascript',url:'javascript:alert(1)'}, null],
];
function destinationFixture(target,decision=()=>true){
 const effects=[],notices=[];let confirmations=0;const account={id:'account'},finding={id:'finding'};
 const location={hash:'#/owner',href:'https://app.invalid/'};
 const ctx=vm.createContext({URL,session:{user:{id:'owner'}},renderEpoch:1,location,
  mailboxSafeId:x=>x,mailboxSelectedAccount:()=>account,mailboxFindings:()=>[finding],mailboxFindingSender:()=> 'Synthetic',
  confirm:()=>decision(++confirmations,ctx,account,finding),toast:x=>notices.push(x),
  mailboxCall:async(action,args)=>{effects.push({action,args:JSON.parse(JSON.stringify(args))});return target;},
  window:{open:(...args)=>{effects.push({open:args});return null;}}
 });
 vm.runInContext(extract(html,'mailboxUnsubscribe'),ctx);
 return {ctx,effects,notices,location,run:()=>ctx.mailboxUnsubscribe('finding')};
}
for(const [name,target,expected] of destinations)test(`unsubscribe destination: ${name}`,async()=>{
 const f=destinationFixture(target);await f.run();
 assert.deepEqual(f.effects[0],{action:'unsubscribe-target',args:{ledgerId:'account',findingId:'finding'}});
 if(expected&&target.kind==='https')assert.deepEqual(f.effects[1],{open:[expected,'_blank','noopener,noreferrer']});
 else {assert.equal(f.effects.length,1);assert.equal(f.location.href,expected||'https://app.invalid/');}
 if(!expected)assert.equal(f.notices.length,1);
});
for(const kind of ['https','mailto'])for(const change of ['cancel','owner','account','finding','route','epoch'])test(`unsubscribe ${kind}: final ${change} prevents navigation`,async()=>{
 const target=destinations.find(([,value])=>value.kind===kind)[1];
 const f=destinationFixture(target,(count,ctx,account,finding)=>{
  if(count===1)return true;
  if(change==='owner')ctx.session.user.id='other';if(change==='account')account.id='other';
  if(change==='finding')finding.sender='other';if(change==='route')ctx.location.hash='#/other';if(change==='epoch')ctx.renderEpoch++;
  return change!=='cancel';
 });
 await f.run();assert.equal(f.effects.length,1);assert.equal(f.location.href,'https://app.invalid/');
});
test('unsubscribe owner changed during first confirmation does not even request target',async()=>{
 const f=destinationFixture(destinations[0][1],(_count,ctx)=>{ctx.session.user.id='other';return true;});await f.run();assert.deepEqual(f.effects,[]);
});
for(const mode of ['cancel','owner','packet','accept'])test(`business copy ${mode} binds exact packet and decision`,async()=>{
 const writes=[];let packet='synthetic',current=true;const ctx=vm.createContext({governanceDialogGuard:()=>()=>current,governanceBusinessExternalReviewPacket:()=>packet,toast:()=>{},copyText:text=>writes.push(text),confirm:()=>{if(mode==='owner')current=false;if(mode==='packet')packet='replaced';return mode!=='cancel';}});
 vm.runInContext(extract(governance,'governanceCopyBusinessReview'),ctx);ctx.governanceCopyBusinessReview('business');assert.deepEqual(writes,mode==='accept'?['synthetic']:[]);
});
for(const mode of ['null-window','window','cancel','changed-owner','changed-account','changed-finding'])test(`unsubscribe ${mode} retains isolation and exact context`,async()=>{
 const notices=[],opens=[];let finish;const account={id:'account'},finding={id:'finding'};const ctx=vm.createContext({URL,session:{user:{id:'owner'}},renderEpoch:1,location:{hash:'#/owner'},mailboxSafeId:x=>x,mailboxSelectedAccount:()=>account,mailboxFindings:()=>[finding],mailboxFindingSender:()=> 'Synthetic',confirm:()=>mode!=='cancel',toast:x=>notices.push(x),mailboxCall:()=>new Promise(r=>finish=r),window:{open:(...args)=>{opens.push(args);return mode==='window'?{}:null;}}});
 vm.runInContext(extract(html,'mailboxUnsubscribe'),ctx);const pending=ctx.mailboxUnsubscribe('finding');
 if(mode==='changed-owner')ctx.session.user.id='other';if(mode==='changed-account')account.id='other';if(mode==='changed-finding')finding.sender='other';
 finish?.({kind:'https',url:'https://synthetic.invalid/unsubscribe',hostname:'synthetic.invalid'});await pending;
 const accepted=['null-window','window'].includes(mode);assert.equal(opens.length,accepted?1:0);if(accepted){assert.equal(opens[0][2],'noopener,noreferrer');assert.match(notices[0],/Requested/);assert.doesNotMatch(notices[0],/browser blocked/);}
});
