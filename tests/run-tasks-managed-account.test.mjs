import assert from 'node:assert/strict';
import test from 'node:test';
import {loadManagedAccount} from '../supabase/functions/run-tasks/managed-account.ts';
const account={id:'ledger',owner:'owner',persona_id:'primary',provider:'twitter',suspended:false};
function store(rows, error=null) {
  return async (table, _columns, filters) => {
    return {data:(rows[table]||[]).find(row=>Object.entries(filters).every(([k,v])=>row[k]===v))||null,error};
  };
}
test('primary and same-owner co-managers can target drafts',async()=>{
 const db=store({account_ledger:[account],account_persona_links:[{ledger_id:'ledger',owner:'owner',persona_id:'shared'}]});
 assert.equal((await loadManagedAccount(db,'owner','primary','ledger')).id,'ledger');
 assert.equal((await loadManagedAccount(db,'owner','shared','ledger')).id,'ledger');
 assert.equal(await loadManagedAccount(db,'owner','other','ledger'),null);
 assert.equal(await loadManagedAccount(db,'foreign','shared','ledger'),null);
});
test('revocation, suspension, missing state, and read failures fail closed',async()=>{
 const rows={account_ledger:[{...account}],account_persona_links:[{ledger_id:'ledger',owner:'owner',persona_id:'shared'}]};
 const db=store(rows);assert.ok(await loadManagedAccount(db,'owner','shared','ledger'));
 rows.account_persona_links=[];assert.equal(await loadManagedAccount(db,'owner','shared','ledger'),null);
 rows.account_ledger[0].suspended=true;assert.equal(await loadManagedAccount(db,'owner','primary','ledger'),null);
 delete rows.account_ledger[0].suspended;assert.equal(await loadManagedAccount(db,'owner','primary','ledger'),null);
 assert.equal(await loadManagedAccount(store({account_ledger:[account]},new Error('unavailable')),'owner','primary','ledger'),null);
});
