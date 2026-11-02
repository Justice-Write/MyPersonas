// Full source-page smoke on intercepted hosts with synthetic signed-out auth.
// No network leaves Playwright routing; no personal profile or live backend.
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
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
  const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!path.startsWith(resolve(root)+'\\'))return route.abort();
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
  assert.deepEqual(errors,[]);results.push({url,final:page.url(),brand,rendered:true});await page.close();
 }
 console.log(JSON.stringify({browser:browser.version(),results,limits:'Synthetic signed-out backend only; real auth/MFA/canary/provider acceptance not performed'},null,2));
 await context.close();
}finally{await browser.close();}
