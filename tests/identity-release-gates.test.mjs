import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('release jobs reject feature refs and validate the exact revision before shipping',async()=>{
 for(const name of ['pages.yml','supabase-deploy.yml']){
  const s=await readFile(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8');
  assert.match(s,/if: github.ref == 'refs\/heads\/main'/);
  assert.match(s,/npm test/);
  assert.doesNotMatch(s,/^  push:/m);
 }
 const pages=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(pages,/MOBILE-077-VERIFIED/);
 assert.ok(pages.indexOf('MOBILE-077-VERIFIED')<pages.indexOf('Prepare public site artifact'));
 const functions=await readFile(new URL('../.github/workflows/supabase-deploy.yml',import.meta.url),'utf8');
 assert.match(functions,/environment: production/);
 assert.doesNotMatch(functions,/supabase functions deploy --project-ref/);
});
