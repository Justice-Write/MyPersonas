// Full source-page smoke on intercepted hosts with synthetic signed-out auth.
// No network leaves Playwright routing; no personal profile or live backend.
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {fixturePath} from './lib/fixture-path.mjs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../MyPersonas.Online_v0/',import.meta.url));
const browser=await chromium.launch({executablePath:process.argv[3],headless:true});
const results=[];
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(()=>{
  const query=()=>{const proxy=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:[],error:null,count:0});return ()=>proxy;}});return proxy;};
  window.supabase={createClient:()=>({from:query,rpc:async()=>({data:[],error:null}),auth:{onAuthStateChange(callback){queueMicrotask(()=>callback('INITIAL_SESSION',null));return {data:{subscription:{unsubscribe(){}}}};},getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}})}})};
 });
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['mypersonas.online','aliaspaces.com'].includes(url.hostname))return route.fulfill({status:200,body:'',contentType:'application/javascript'});
  const path=await fixturePath(root,url.pathname);
  if(!path)return route.abort();
  try{const body=await readFile(path),type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'}[extname(path)]||'application/octet-stream';return route.fulfill({body,contentType:type});}catch{return route.fulfill({status:404,body:'fixture missing'});}
 });
 for(const [url,host,brand,heading] of [
  ['https://mypersonas.online/','mypersonas.online','MyPersonas',''],
  ['https://aliaspaces.com/','aliaspaces.com','AliaSpaces',''],
  ['https://mypersonas.online/#/signin','mypersonas.online','MyPersonas','Welcome to MyPersonas'],
  ['https://aliaspaces.com/#/signin','aliaspaces.com','AliaSpaces','Welcome to AliaSpaces'],
  ['https://aliaspaces.com/#/library','mypersonas.online','MyPersonas','Welcome to MyPersonas'],
  ['https://mypersonas.online/#/search/synthetic','aliaspaces.com','AliaSpaces',''],
 ]){
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#app')?.textContent.trim().length>20);
  await page.waitForFunction(brand=>document.querySelector('#siteIdentity')?.textContent===brand,brand);
  assert.equal(new URL(page.url()).hostname,host);if(heading)assert.ok((await page.locator('#app').innerText()).includes(heading));
  assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute('content'),brand);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),`https://${host}/`);
  assert.doesNotMatch(await page.locator('body').innerText(),/never linked|identity stays private|never show who owns/i);assert.doesNotMatch(await page.locator('meta[name="description"]').getAttribute('content'),/anonymous|never linked|unlinkab/i);
  assert.deepEqual(errors,[]);results.push({url,final:page.url(),brand,rendered:true});await page.close();
 }
 // Real full-page owner preview with a synthetic authenticated roster. The
 // backend remains the intercepted empty fixture; no private records are read.
 const preview=await context.newPage(),previewErrors=[];preview.on('pageerror',e=>previewErrors.push(e.message));
 await preview.goto('https://mypersonas.online/');await preview.waitForFunction(()=>typeof renderOwnerPersonaPreview==='function'&&document.querySelector('#app')?.textContent.trim().length>20);
 await preview.evaluate(()=>{
   session={user:{id:'synthetic-owner'}};privateSessionReady=true;
   myPersonas=[{id:'11111111-1111-4111-8111-111111111111',handle:'synthetic-a',name:'Synthetic A'},
     {id:'22222222-2222-4222-8222-222222222222',handle:'synthetic-b',name:'Synthetic B',visibility:'private',publication_state:'draft'}];
   ownerAppState.selectedPersonaId=myPersonas[0].id;ownerAppState.viewMode='overview';
   go('owner-preview/synthetic-b');
 });
 await preview.waitForFunction(()=>document.querySelector('#app')?.textContent.includes('Edit page'));
 assert.equal(new URL(preview.url()).hostname,'mypersonas.online');
 assert.ok((await preview.locator('#app').innerText()).includes('Synthetic B'));
 assert.deepEqual(previewErrors,[]);results.push({url:preview.url(),rendered:true,privateSiblingPreview:true});await preview.close();
 console.log(JSON.stringify({browser:browser.version(),results,limits:'Synthetic backend and owner preview roster only; real auth/MFA/canary/provider acceptance not performed'},null,2));
 await context.close();
}finally{await browser.close();}
