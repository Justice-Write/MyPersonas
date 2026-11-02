import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../MyPersonas.Online_v0/pwa.js',import.meta.url),'utf8');
test('versioned helper URL bypasses exact public-shell cache matching',async()=>{
  const worker=await readFile(new URL('../MyPersonas.Online_v0/service-worker.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../MyPersonas.Online_v0/index.html',import.meta.url),'utf8');
  const script=html.match(/<script src="(\.\/pwa\.js\?v=[^"]+)" defer>/)?.[1];assert.ok(script);
  const events=new Map();const cached={marker:'old cached helper'};
  vm.runInNewContext(worker,{URL,self:{registration:{scope:'https://mypersonas.online/'},addEventListener:(name,fn)=>events.set(name,fn)},caches:{open:async()=>({match:async()=>cached})}});
  let handled=false;
  events.get('fetch')({request:{method:'GET',mode:'cors',url:new URL(script,'https://mypersonas.online/').href},respondWith(){handled=true;}});
  assert.equal(handled,false,'versioned request must reach network instead of old exact-match cache');
  let response;
  events.get('fetch')({request:{method:'GET',mode:'cors',url:'https://mypersonas.online/pwa.js'},respondWith(value){response=value;}});
  assert.equal(await response,cached,'unversioned public-shell cache behavior is preserved');
});
function page(hostname,{mobile=false,registrationFails=false}={}){
  const elements=new Map(),events=new Map(),updates=new Map(),registrations=[],warnings=[];
  const mount={insertBefore(node){node.isConnected=true;node.parentNode=this;elements.set(node.id,node);}};
  const registration={waiting:{},addEventListener:(name,callback)=>updates.set(name,callback)};
  const navigator={userAgent:mobile?'Mozilla Android':'Desktop',platform:'',maxTouchPoints:0,
    serviceWorker:{controller:{},async register(url,options){registrations.push({url,options});if(registrationFails)throw new Error('synthetic');return registration;}}};
  const window={navigator,matchMedia:()=>({matches:false}),addEventListener:(name,callback)=>events.set(name,callback),clearTimeout(){},setTimeout(){return 1;}};
  const document={baseURI:`https://${hostname}/nested/`,body:mount,querySelector:()=>mount,getElementById:id=>elements.get(id),createElement:()=>({style:{},attributes:{},listeners:{},setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,callback){this.listeners[name]=callback;}})};
  vm.runInNewContext(source,{window,document,navigator,location:{hostname,protocol:'https:',origin:`https://${hostname}`},URL,console:{warn:(...args)=>warnings.push(args)}});
  return {events,elements,registration,updates,registrations,warnings};
}
for(const [host,brand] of [['mypersonas.online','MyPersonas'],['www.mypersonas.online','MyPersonas'],['aliaspaces.com','AliaSpaces'],['www.aliaspaces.com','AliaSpaces'],['localhost','MyPersonas'],['aliaspaces.com.example.test','MyPersonas']]){
  test(`PWA install and waiting-update events use ${brand} on ${host}`,async()=>{
    const p=page(host);await p.events.get('load')();
    const status=p.elements.get('pwaInstallStatus');
    assert.equal(status.textContent,`${brand} has an update ready. Close every ${brand} tab and reopen the app to apply it.`);
    assert.equal(p.registrations[0].url,`https://${host}/nested/service-worker.js`);
    assert.equal(p.registrations[0].options.scope,`https://${host}/nested/`);
    assert.equal(p.registrations[0].options.updateViaCache,'none');
    let prompted=0,prevented=0;
    p.events.get('beforeinstallprompt')({preventDefault(){prevented++;},async prompt(){prompted++;},userChoice:Promise.resolve({outcome:'accepted'})});
    const button=p.elements.get('pwaInstallButton');assert.equal(button.attributes['aria-label'],`Install ${brand} on this device`);
    await button.listeners.click();assert.equal(status.textContent,`${brand} installation started.`);assert.equal(prompted,1);assert.equal(prevented,1);
    p.events.get('appinstalled')();assert.equal(status.textContent,`${brand} was installed.`);assert.equal(button.hidden,true);
  });
}
for(const [host,brand] of [['mypersonas.online','MyPersonas'],['aliaspaces.com','AliaSpaces']]){
  test(`PWA help and failure copy retain host identity on ${host}`,async()=>{
    const p=page(host,{mobile:true,registrationFails:true});const button=p.elements.get('pwaInstallButton');
    assert.equal(button.attributes['aria-label'],`Show ${brand} installation instructions`);
    p.events.get('beforeinstallprompt')({preventDefault(){},async prompt(){throw new Error('synthetic');}});
    await button.listeners.click();assert.match(p.elements.get('pwaInstallStatus').textContent,new RegExp(`install ${brand}\\.`));assert.equal(button.disabled,false);
    await p.events.get('load')();assert.equal(p.warnings[0][0],`${brand} offline shell registration failed.`);
  });
}
