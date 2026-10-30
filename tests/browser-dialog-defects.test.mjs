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
