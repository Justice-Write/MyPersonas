// Actual cross-origin navigation and storage, synthetic roster only. Every
// request is fulfilled locally or aborted; no backend/provider/social actions.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {domainSource,selectionSource,A,B,missing,roster,storageKey,modeKey} from '../tests/lib/persona-handoff-fixture.mjs';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({executablePath:process.argv[3],headless:true,args:['--disable-background-networking']});
const results=[];let fixtures=0,aborted=0;
const html=`<!doctype html><title>Synthetic identity fixture</title><script>${domainSource}</script><script>
window.session={user:{id:'owner-1'}};window.privateSessionReady=false;
window.myPersonas=${JSON.stringify(roster)};
window.ownerAppState={selectedPersonaId:'',viewMode:'overview',perspectiveGeneration:0};
window.toast=()=>{};${selectionSource}
window.fixtureReady=true;
</script>`;
try {
  for(const [label,saved,selected,destinationRoster,expected] of [
    ['empty destination', '',B,roster,B],['destination previously A',A,B,roster,B],
    ['destination previously B',B,B,roster,B],['deleted destination selection',missing,B,roster,B],
    ['intended persona no longer owned',A,B,[roster[0]],null],
    ['sign-in reload before roster ready',A,B,roster,B],
  ]) {
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(({saved,storageKey,modeKey})=>{
      window.fetch=()=>{throw Error('Network forbidden')};window.XMLHttpRequest=function(){throw Error('Network forbidden')};window.WebSocket=function(){throw Error('Network forbidden')};
      if(location.hostname==='aliaspaces.com'&&!sessionStorage.getItem('fixture-seeded')){
        localStorage.setItem(storageKey,saved);localStorage.setItem(modeKey,'persona');sessionStorage.setItem('fixture-seeded','1');
      }
    },{saved,storageKey,modeKey});
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(['https://mypersonas.online','https://aliaspaces.com'].includes(u.origin)&&u.pathname==='/'){fixtures++;return route.fulfill({body:html,contentType:'text/html'});}
      aborted++;return route.abort();
    });
    const page=await context.newPage();await page.goto('https://mypersonas.online/#/owner');
    await page.evaluate(({selected,storageKey})=>{privateSessionReady=true;ownerAppState.selectedPersonaId=selected;localStorage.setItem(storageKey,selected);ownerAppSetViewMode('persona');},{selected,storageKey});
    await page.waitForURL('https://aliaspaces.com/#/owner');await page.waitForFunction(()=>window.fixtureReady);
    assert.equal(await page.evaluate(()=>ownerAppPersonaModeActor()),null,'MFA/roster not ready');
    if(label==='sign-in reload before roster ready'){
      await page.reload();await page.waitForFunction(()=>window.fixtureReady);
      assert.equal(await page.evaluate(()=>ownerAppPersonaModeActor()),null);
    }
    await page.evaluate(({destinationRoster})=>{myPersonas=destinationRoster;privateSessionReady=true;ownerAppRestorePersona('owner-1');},{destinationRoster});
    assert.equal(await page.evaluate(()=>ownerAppPersonaModeActor()?.id||null),expected);
    // A reload uses the validated selection, not an old destination actor.
    await page.reload();await page.waitForFunction(()=>window.fixtureReady);
    await page.evaluate(({destinationRoster})=>{myPersonas=destinationRoster;privateSessionReady=true;ownerAppRestorePersona('owner-1');},{destinationRoster});
    assert.equal(await page.evaluate(()=>ownerAppPersonaModeActor()?.id||null),expected);
    const control=await context.newPage();await control.goto('https://mypersonas.online/#/owner');
    assert.equal(await control.evaluate(key=>localStorage.getItem(key),storageKey),B,'separate control storage unchanged');
    results.push({label,actualActor:expected,passed:true});await context.close();
  }
  console.log(JSON.stringify({browser:browser.version(),results,fixtures,aborted,networkContinues:0,limits:'Real browser cross-origin navigation with actual domain and selection functions; synthetic authentication/roster. No live auth, MFA, RPC, provider calls or social mutations.'},null,2));
} finally {await browser.close();}
