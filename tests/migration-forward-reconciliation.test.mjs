import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import test from 'node:test';
const root=new URL('../',import.meta.url);
test('post-043 logical migrations have unique identities and forward mirrors match',async()=>{
 // Older 016/017/018/027/041/042/043 collisions are historical; never rename applied history.
 const files=(await readdir(new URL('MyPersonas.Online_v0/sql-updates/',root))).filter(x=>/^\d{3}-.*\.sql$/.test(x)&&Number(x.slice(0,3))>=44&&!x.includes('.DRAFT.'));
 const ids=files.map(x=>x.slice(0,3));assert.equal(new Set(ids).size,ids.length,'duplicate logical migration identifiers');
 for(const [canonical,mirror] of [
  ['078-edit-ai-backend-base-url.sql','20260927134221_edit_ai_backend_base_url_reconciliation.sql'],
  ['079-persona-media-unchanged-url-compatibility.sql','20260927134223_persona_media_unchanged_url_forward_reconciliation.sql']
 ]) assert.equal(await readFile(new URL('MyPersonas.Online_v0/sql-updates/'+canonical,root),'utf8'),await readFile(new URL('supabase/migrations/'+mirror,root),'utf8'));
});
