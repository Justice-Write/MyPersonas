import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {insideRoot,fixturePath} from '../scripts/lib/fixture-path.mjs';
import {readSite,domainSource,selectionSource,A,B,missing,roster,storageKey,modeKey,intentKey} from './lib/persona-handoff-fixture.mjs';
const store = (entries=[]) => { const map=new Map(entries); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}; };
function boot(href,{saved=A,mode='persona',ready=true,owned=roster,tab=store(),uid='owner-1'}={}) {
  const url=new URL(href),events=[];
  const location={get href(){return url.href},get hostname(){return url.hostname},get origin(){return url.origin},get pathname(){return url.pathname},get search(){return url.search},get hash(){return url.hash},assign:x=>events.push(x),replace:x=>events.push(x)};
  const ctx=vm.createContext({URL,location,sessionStorage:tab,localStorage:store([[storageKey,saved],[modeKey,mode]]),session:uid?{user:{id:uid}}:null,privateSessionReady:ready,myPersonas:structuredClone(owned),ownerAppState:{selectedPersonaId:'',viewMode:'overview',perspectiveGeneration:0},history:{state:null,replaceState(_s,_t,next){url.href=new URL(next,url).href}},toast(){},Date});
  vm.runInContext(domainSource+'\n'+selectionSource,ctx);
  return {ctx,url,events};
}
for(const saved of ['',A,B,missing]) test(`incoming B overrides destination selection ${saved||'empty'}`,()=>{
  const {ctx,url,events}=boot(`https://aliaspaces.com/#/owner/${B}`,{saved});
  assert.equal(url.hash,'#/owner');assert.deepEqual(events,[]);
  ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor().id,B);
  assert.equal(ctx.localStorage.getItem(storageKey),B);assert.equal(ctx.MyPersonasDomains.takePersonaIntent(),null);
  ctx.myPersonas.reverse();ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor().id,B);
});
for(const id of [missing,'garbage','',`${B}/extra`,encodeURIComponent(B+'?x=1')]) test(`invalid incoming identity ${id} refuses saved A`,()=>{
  const {ctx}=boot(`https://aliaspaces.com/#/owner/${id}`);
  ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor(),null);assert.equal(ctx.ownerAppState.selectedPersonaId,'');
  ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor(),null,'failed intent cannot revive saved A on refresh');
  assert.equal(ctx.ownerAppSelectActingPersona(B),true);assert.equal(ctx.ownerAppPersonaModeActor().id,B);
});
for(const saved of ['',missing]) test(`missing/deleted saved actor ${saved} never activates first roster entry`,()=>{
  const {ctx}=boot('https://aliaspaces.com/#/owner',{saved});ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor(),null);
});
test('no activation or intent consumption before authenticated MFA-ready roster; stale UID refused',()=>{
  const {ctx}=boot(`https://aliaspaces.com/#/owner/${B}`,{ready:false});
  ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor(),null);assert.equal(ctx.ownerAppSelectActingPersona(A),false);
  ctx.privateSessionReady=true;ctx.ownerAppRestorePersona('different-owner');assert.equal(ctx.ownerAppPersonaModeActor(),null);
  ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor().id,B);
});
test('pending intent survives same-tab sign-in reload but foreign roster cannot activate it',()=>{
  const tab=store();const first=boot(`https://aliaspaces.com/#/owner/${B}`,{tab,uid:null});
  first.ctx.ownerAppRestorePersona('owner-1');assert.equal(first.ctx.ownerAppPersonaModeActor(),null);
  const second=boot('https://aliaspaces.com/#/owner',{tab,owned:[roster[0]]});second.ctx.ownerAppRestorePersona('owner-1');assert.equal(second.ctx.ownerAppPersonaModeActor(),null);
});
test('expired pending intent refuses fallback and is consumed',()=>{
  const tab=store([[intentKey,JSON.stringify({id:B,at:Date.now()-16*60*1000})]]);
  const {ctx}=boot('https://aliaspaces.com/#/owner',{tab});ctx.ownerAppRestorePersona('owner-1');assert.equal(ctx.ownerAppPersonaModeActor(),null);assert.equal(tab.getItem(intentKey),null);
});
test('control switch checks exact owned selection before generating fragment-only transfer',()=>{
  const {ctx,events}=boot('https://mypersonas.online/#/owner');ctx.ownerAppState.selectedPersonaId=missing;
  assert.equal(ctx.ownerAppSetViewMode('persona'),false);assert.deepEqual(events,[]);
  ctx.ownerAppState.selectedPersonaId=B;assert.equal(ctx.ownerAppSetViewMode('persona'),true);assert.deepEqual(events,[`https://aliaspaces.com/#/owner/${B}`]);
});
test('owner preview and public sharing have separate host contracts',()=>{
  const control=boot('https://mypersonas.online/#/owner-preview/synthetic-b');assert.deepEqual(control.events,[]);
  const social=boot('https://aliaspaces.com/#/owner-preview/synthetic-b');assert.deepEqual(social.events,['https://mypersonas.online/?hop=1#/owner-preview/synthetic-b']);
  assert.equal(control.ctx.MyPersonasDomains.publicUrl('p/synthetic-b'),'https://aliaspaces.com/#/p/synthetic-b');
});
test('private preview wrapper verifies session, assurance and owned handle before rendering',async()=>{
  const html=readSite('index.html'),start=html.indexOf('async function renderOwnerPersonaPreview('),end=html.indexOf('async function renderPersonaPage(',start);
  const calls=[],ctx=vm.createContext({domainRole:()=> 'control',session:{user:{id:'owner-1'}},privateSessionReady:true,myPersonas:roster,renderEpoch:1,app:{innerHTML:''},renderSignin:()=>calls.push('signin'),renderPersonaPage:(...args)=>calls.push(args)});
  vm.runInContext(html.slice(start,end),ctx);await ctx.renderOwnerPersonaPreview('synthetic-b',false,1);assert.deepEqual(calls.pop(),['synthetic-b',false,1,true]);
  await ctx.renderOwnerPersonaPreview('foreign',false,1);assert.equal(calls.length,0);
  ctx.privateSessionReady=false;await ctx.renderOwnerPersonaPreview('synthetic-b');assert.equal(calls.length,0);
  ctx.session=null;await ctx.renderOwnerPersonaPreview('synthetic-b');assert.equal(calls.pop(),'signin');
  ctx.domainRole=()=> 'social';ctx.location={assign:url=>calls.push(url)};ctx.MyPersonasDomains={managementUrl:p=>'https://mypersonas.online/#/'+p};
  await ctx.renderOwnerPersonaPreview('synthetic-b');assert.equal(calls.pop(),'https://mypersonas.online/#/owner-preview/synthetic-b');
  assert.match(html,/if\(!ownerPreview&&typeof ownerAppIsPersonaMode/);
  assert.match(html,/data-persona-nav onclick="goDiscover\(\)">Entangle/);
  assert.match(html,/go\('owner-preview\/\$\{esc\(p.handle\)\}'\)">View/);
});
for(const stage of ['profile','details'])for(const change of ['logout','account switch','MFA revoked','auth generation','roster removed'])test(`owner preview discards ${stage} completion after ${change}`,async()=>{
  const html=readSite('index.html'),start=html.indexOf('async function renderPersonaPage('),end=html.indexOf('function postHtml(',start);
  let release,started;const pending=new Promise(resolve=>{release=resolve}),entered=new Promise(resolve=>{started=resolve});
  const owned={...roster[1],visibility:'private',publication_state:'draft'};
  const query=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:[]});return ()=>query;}});
  const ctx=vm.createContext({session:{user:{id:'owner-1'}},privateSessionReady:true,authLoadGeneration:1,myPersonas:[owned],renderEpoch:1,app:{innerHTML:''},
    ownerAppIsPersonaMode:()=>true,renderPersonaModeProfile:()=>{throw Error('Preview must not use actor projection')},
    sb:{from:()=>query,rpc:async name=>{if(name===(stage==='profile'?'persona_by_handle':'persona_page_layout')){started();return pending}return {data:name==='persona_by_handle'?[owned]:[]}}},
    document:{querySelectorAll:()=>[]},abortAppDialogs(){},publicFanChatStatus:async()=>false,PERSONA_FEED_PAGE_SIZE:30});
  vm.runInContext(html.slice(start,end),ctx);const rendering=ctx.renderPersonaPage('synthetic-b',false,1,true);await entered;
  if(change==='logout')ctx.session=null;
  if(change==='account switch')ctx.session={user:{id:'owner-2'}};
  if(change==='MFA revoked')ctx.privateSessionReady=false;
  if(change==='auth generation')ctx.authLoadGeneration++;
  if(change==='roster removed')ctx.myPersonas=[];
  ctx.app.innerHTML='New account screen';release({data:stage==='profile'?[owned]:[]});await rendering;
  assert.equal(ctx.app.innerHTML,'New account screen','stale private preview must not write DOM');
});
for(const [name,paths,root] of [['POSIX',path.posix,'/tmp/site root'],['Windows',path.win32,'C:/site root']]) test(`${name} fixture containment accepts nested files and rejects traversal/sibling roots`,()=>{
  assert.equal(insideRoot(root,paths.resolve(root,'assets/a.js'),paths),true);
  for(const target of [root,paths.resolve(root,'..','secret'),root+'-sibling/a.js'])assert.equal(insideRoot(root,target,paths),false);
});
test('fixture resolver rejects encoded traversal, missing files and symlink escape',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'persona-fixture-'));
  try {
    const root=path.join(temp,'site');await mkdir(root);await writeFile(path.join(root,'index.html'),'fixture');await writeFile(path.join(temp,'outside'),'private');
    assert.ok(await fixturePath(root,'/'));assert.equal(await fixturePath(root,'/%2e%2e/outside'),null);assert.equal(await fixturePath(root,'/%zz'),null);assert.equal(await fixturePath(root,'/missing'),null);
    // Directory junctions are available without Windows symlink privilege.
    const external=path.join(temp,'external');await mkdir(external);await writeFile(path.join(external,'file'),'private');await symlink(external,path.join(root,'escape'),process.platform==='win32'?'junction':'dir');
    assert.equal(await fixturePath(root,'/escape/file'),null);
  } finally { assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));await rm(temp,{recursive:true,force:true}); }
});
