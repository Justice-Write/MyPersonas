// Synthetic, headless-only browser qualification. No real account or clipboard IO.
// Usage: node scripts/qualify-dialog-browser.mjs <playwright-index.mjs> <browser.exe>
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const source=readFileSync(new URL('../MyPersonas.Online_v0/index.html',import.meta.url),'utf8');
function extract(name){
 const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
 assert.ok(start>=0);const rest=source.slice(start),end=rest.slice(1).search(/^(?:async )?function \w+\(/m);
 return rest.slice(0,end<0?undefined:end+1);
}
const browser=await chromium.launch({executablePath:process.argv[3],headless:true,ignoreDefaultArgs:['--disable-popup-blocking']});
const results=[];
try{
 const context=await browser.newContext();
 // Every request is fulfilled locally: no remote provider, app or account access.
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic qualification</title><button id="start">Start</button>'}));
 const page=await context.newPage();await page.goto('https://fixture.invalid/');
 await page.addScriptTag({content:source.split('\n').find(line=>line.startsWith('function esc('))+'\n'+source.slice(source.indexOf('let appDialogChain='),source.indexOf('function ownerWorkflowDialogs(){'))});
 await page.evaluate(()=>{document.querySelector('#start').onclick=async()=>{
  window.result=null;const accepted=await appConfirm('Synthetic confirmation',{destructive:true});
  window.result={accepted,active:navigator.userActivation.isActive};
  if(accepted){const opened=window.open('https://fixture.invalid/destination','_blank','noopener,noreferrer');window.result.returnedNull=opened===null;}
 };});
 await page.click('#start');assert.equal(await page.locator('#appDialogCancel').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Escape');assert.equal((await page.evaluate(()=>window.result)).accepted,false);
 assert.equal(context.pages().length,1);results.push('Escape cancels; no popup; destructive default focuses Cancel');
 await page.click('#start');const popupPromise=page.waitForEvent('popup');await page.click('#appDialogOk');const popup=await popupPromise;await popup.waitForLoadState();
 const activation=await page.evaluate(()=>window.result);assert.equal(activation.active,true);assert.equal(activation.returnedNull,true);assert.equal(await popup.evaluate(()=>window.opener),null);
 results.push('Shared-dialog OK click preserves activation; noopener popup opens despite null window.open return');await popup.close();
 const cases=['accepted','blank','cancel','expired','pending-owner','session-replaced','generation-replaced'];
 for(const scenario of cases){
  const p=await context.newPage();await p.goto('https://fixture.invalid/?code=synthetic-code');
  await p.evaluate(scenario=>{
   window.scenario=scenario;window.calls=[];window.notices=[];window.session={user:{id:'synthetic-owner'}};window.authLoadGeneration=1;
   window.CONFIG={SUPABASE_URL:'https://provider.invalid'};window.toast=x=>notices.push(x);window.showOpenRouterKeyWarning=x=>notices.push(x);window.loadMine=async()=>{};window.go=()=>{};
   sessionStorage.setItem('or_pkce',JSON.stringify({verifier:'synthetic-verifier',initiatingUserId:scenario==='pending-owner'?'other':'synthetic-owner',createdAt:Date.now()-(scenario==='expired'?660000:0)}));
   let count=0;window.sb={auth:{getSession:async()=>{count++;if(count===2&&scenario==='generation-replaced')authLoadGeneration++;return {data:{session:{user:{id:count===2&&scenario==='session-replaced'?'other':'synthetic-owner'},access_token:'synthetic-token'}}};}}};
   window.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({connected:true})}};
  },scenario);
  p.on('dialog',dialog=>scenario==='cancel'?dialog.dismiss():dialog.accept(scenario==='blank'?'':'synthetic-model'));
  await p.addScriptTag({content:extract('captureOpenRouterReturn')+'\n'+extract('handleOAuthReturn')});
  await p.evaluate(async()=>{captureOpenRouterReturn();await handleOAuthReturn();});
  const state=await p.evaluate(()=>({calls,pkce:sessionStorage.getItem('or_pkce'),code:sessionStorage.getItem('or_return_code'),url:location.href}));
  assert.equal(state.pkce,null);assert.equal(state.code,null);assert.equal(new URL(state.url).searchParams.has('code'),false);
  const shouldSend=['accepted','blank','cancel'].includes(scenario);assert.equal(state.calls.length,shouldSend?1:0);
  if(shouldSend)assert.deepEqual(state.calls[0].body,{code:'synthetic-code',codeVerifier:'synthetic-verifier',model:scenario==='accepted'?'synthetic-model':''});
  results.push(`Existing OAuth callback: ${scenario}; ${shouldSend?'one mocked exchange':'no exchange'}`);await p.close();
 }
 console.log(JSON.stringify({browser:browser.version(),results,limitations:['Headless synthetic Edge only; no physical WebView or assistive technology','No clipboard read/write, OS mail-handler invocation, authenticated account or provider exchange','Native OAuth prompt cancellation currently continues with blank optional model; behavior recorded, not endorsed or changed']},null,2));
 await context.close();
}finally{await browser.close();}
