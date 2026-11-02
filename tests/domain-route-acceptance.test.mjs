import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../MyPersonas.Online_v0/'+name,import.meta.url),'utf8');
const split=read('domain-split.js'),html=read('index.html');
const route=html.slice(html.indexOf('async function route(){'),html.indexOf('// ---------- sign in ----------'));
function fixture(href,{signedIn=false,ready=true,persona=false}={}){
 const url=new URL(href),events=[],nodes=new Map();
 const document={title:'',querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{setAttribute(key,value){this[key]=value;},textContent:''});return nodes.get(selector);},getElementById:id=>id==='siteIdentity'?document.querySelector('#siteIdentity'):null,body:{classList:{remove(){},toggle(){}},style:{}}};
 const location={get hostname(){return url.hostname},get href(){return url.href},get hash(){return url.hash},get origin(){return url.origin},get pathname(){return url.pathname},assign:x=>events.push(['assign',x]),replace:x=>events.push(['replace',x])};
 const ctx=vm.createContext({URL,document,location,window:{},history:{state:{},replaceState(_s,_t,path){url.href=new URL(path,url).href;}},session:signedIn?{user:{id:'synthetic'}}:null,privateSessionReady:ready,renderEpoch:0,app:{innerHTML:''},mfaLoginGate:{active:!ready},setMeta(title){document.title=title;},ownerAppIsPersonaMode:()=>persona,personaViewRouteGuard:()=>false,renderSidebar(){},syncPersonaViewChrome(){},ownerAppMobileNav(){},domainState:()=>({ready:signedIn&&ready,mode:persona?'persona':'overview'})});
 for(const name of ['renderMfaLoginGate','renderCreativeLanding','renderDiscover','renderSignin','renderOwnerCommandCenter','renderPersonaViewHome','renderPersonaPage','renderBusinessPage','renderFriendInvite','renderCreativeWorkspace','renderPublicationReview'])ctx[name]=(...args)=>events.push([name,...args]);
 vm.runInContext(split,ctx);ctx.domainRole=()=>ctx.MyPersonasDomains.role();vm.runInContext(route,ctx);
 return {ctx,events,nodes,url,document,run:()=>ctx.route()};
}
for(const host of ['mypersonas.online','www.mypersonas.online','aliaspaces.com','www.aliaspaces.com'])test(`${host}: host identity has no callback or private URL data`,()=>{
 const f=fixture(`https://${host}/?code=synthetic-secret#/signin`),social=host.includes('aliaspaces'),name=social?'AliaSpaces':'MyPersonas',origin=social?'https://aliaspaces.com':'https://mypersonas.online';
 assert.equal(f.nodes.get('meta[property="og:site_name"]').content,name);
 assert.equal(f.nodes.get('meta[name="apple-mobile-web-app-title"]').content,name);
 assert.equal(f.nodes.get('link[rel="canonical"]').href,origin+'/');
 assert.equal(f.nodes.get('meta[property="og:url"]').content,origin+'/');
 const schema=JSON.parse(f.nodes.get('script[type="application/ld+json"]').textContent);assert.equal(schema.name,name);assert.equal(schema.url,origin+'/');assert.doesNotMatch(JSON.stringify([...f.nodes]),/synthetic-secret/);
});
for(const [host,signedIn,persona,hash,renderer] of [
 ['mypersonas.online',false,false,'','renderCreativeLanding'],
 ['mypersonas.online',true,false,'','renderOwnerCommandCenter'],
 ['mypersonas.online',true,false,'#/library','renderCreativeWorkspace'],
 ['aliaspaces.com',false,false,'','renderDiscover'],
 ['aliaspaces.com',true,true,'#/owner','renderPersonaViewHome'],
 ['aliaspaces.com',false,false,'#/p/synthetic','renderPersonaPage'],
 ['aliaspaces.com',false,false,'#/b/synthetic','renderBusinessPage'],
 ['aliaspaces.com',false,false,'#/friend-invite/synthetic','renderFriendInvite'],
 ['mypersonas.online',false,false,'#/signin','renderSignin'],
 ['aliaspaces.com',false,false,'#/signin','renderSignin'],
])test(`${host} ${hash||'root'} ${signedIn?'signed in':'signed out'} invokes correct actual router branch`,async()=>{
 const f=fixture(`https://${host}/${hash}`,{signedIn,persona});await f.run();assert.equal(f.events.at(-1)[0],renderer);assert.equal(f.events.some(e=>['replace','assign'].includes(e[0])),false);assert.equal(f.nodes.get('#siteIdentity').textContent,host.includes('aliaspaces')?'AliaSpaces':'MyPersonas');
});
test('owner root waits for MFA readiness instead of rendering workspace',async()=>{
 const f=fixture('https://mypersonas.online/',{signedIn:true,ready:false});await f.run();assert.equal(f.events.at(-1)[0],'renderMfaLoginGate');assert.equal(f.url.hash,'');
});
for(const [host,hash,destination] of [
 ['mypersonas.online','#/p/persona','https://aliaspaces.com/?hop=1#/p/persona'],
 ['aliaspaces.com','#/review/persona','https://mypersonas.online/?hop=1#/review/persona'],
 ['aliaspaces.com','#/library','https://mypersonas.online/?hop=1#/library'],
])test(`${host} ${hash} exits before rendering a wrong-host surface`,async()=>{
 const f=fixture(`https://${host}/${hash}`);await f.run();assert.ok(f.events.length>0);assert.ok(f.events.every(e=>e[0]==='replace'&&e[1]===destination));
});
for(const host of ['aliaspaces.com','mypersonas.online'])test(`${host} preserves same-origin callback until code consumption`,()=>{
 const wrong=host==='aliaspaces.com'?'studio':'p/persona';const f=fixture(`https://${host}/?code=synthetic#/${wrong}`);assert.deepEqual(f.events,[]);assert.equal(f.ctx.MyPersonasDomains.leave({ready:true}),false);
 f.url.search='';assert.equal(f.ctx.MyPersonasDomains.leave({ready:true}),true);assert.doesNotMatch(f.events[0][1],/synthetic|code=/);
});
test('management package identity keeps installed-app id and private cache boundary',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.short_name,'MyPersonas');for(const key of ['id','scope','start_url'])assert.equal(manifest[key],'./');assert.ok(manifest.shortcuts.every(s=>!s.description.startsWith('Open your AliaSpaces')));
 assert.match(html, /name="apple-mobile-web-app-title" content="MyPersonas"/);assert.match(html, /"@type":"WebSite","name":"MyPersonas"/);assert.match(read('offline.html'),/<title>Offline — MyPersonas<\/title>/);
 const worker=read('service-worker.js'),shell=worker.slice(worker.indexOf('const PUBLIC_SHELL_PATHS'),worker.indexOf('const SCOPE_URL'));assert.doesNotMatch(shell,/index\.html|domain-split\.js|owner-app\.js/);assert.match(worker,/2026-11-02-1/);
});
test('backend workflow path guard accepts GitHub run path forms without accepting other workflows or refs',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const pattern=workflow.match(/--jq \.path \| grep -Eq '([^']+)'/)[1];const guard=new RegExp(pattern);
 for(const path of ['.github/workflows/supabase-deploy.yml','.github/workflows/supabase-deploy.yml@refs/heads/main'])assert.equal(guard.test(path),true,path);
 for(const path of ['.github/workflows/ci.yml','.github/workflows/supabase-deploy.yml@refs/heads/other','.github/workflows/supabase-deploy.yml.evil','prefix.github/workflows/supabase-deploy.yml'])assert.equal(guard.test(path),false,path);
 for(const field of ['head_sha','head_branch','event','status','conclusion'])assert.ok(workflow.includes(`--jq .${field}`));
 assert.match(workflow,/IMAGE-CAPTION-CANARY-VERIFIED/);assert.match(workflow,/sha=\$\{GITHUB_SHA\}/);
});

test("runtime social copy does not promise anonymity or unlinkability",()=>{assert.doesNotMatch(html,/never linked to your identity|identity stays private|never show who owns|[Aa]nonymous persona pages/);});
