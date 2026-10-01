import assert from 'node:assert/strict';
import test from 'node:test';
await import('../MyPersonas.Online_v0/mobile-owner-workflow.js');
const workflow = globalThis.MobileOwnerWorkflow;
const ownerId = 'synthetic-owner';
const personaId = 'synthetic-persona';
const accounts = ['x', 'instagram', 'facebook', 'website'].map(provider => ({
  id: `synthetic-${provider}`, owner: ownerId, persona_id: personaId, provider,
}));
const bindings = workflow.channelBindings(accounts, ownerId, personaId);
const pack = { id: 'synthetic-kit', owner: ownerId, persona_id: personaId, status: 'approved' };
const decide = value => workflow.approvalDecision({ ownerId, pack, action: 'manual_schedule', bindings: value });

test('missing, empty, partial, and duplicate channel bindings cannot prepare a schedule', () => {
  for (const value of [undefined, [], bindings.slice(1), [bindings[0], bindings[0], bindings[2], bindings[3]]]) {
    assert.equal(decide(value).ok, false);
    assert.equal(workflow.reviewItem(pack, [], null, value).canSchedule, false);
  }
});

test('claimed determination without an exact ledger account and matching provider is rejected', () => {
  for (const replacement of [
    { ...bindings[0], account: null },
    { ...bindings[0], account: { provider: 'x' } },
    { ...bindings[0], account: { id: 'synthetic-wrong-provider', provider: 'instagram' } },
    { ...bindings[0], determinable: false },
  ]) assert.equal(decide([replacement, ...bindings.slice(1)]).ok, false);
});

test('four exact owned bindings prepare only the existing server preview', () => {
  const result = decide(bindings);
  assert.equal(result.ok, true);
  assert.equal(result.rpc, 'content_package_preview_snapshot');
  assert.equal(result.publishes, false);
  assert.equal(workflow.reviewItem(pack, [], null, bindings).canSchedule, true);
  assert.equal(workflow.PUBLISHING_ENABLED, false);
});

test('cross-owner and suspended ledger entries cannot satisfy schedule preparation', () => {
  for (const replacement of [{ ...accounts[0], owner: 'synthetic-other-owner' }, { ...accounts[0], suspended: true }]) {
    const scoped = workflow.channelBindings([replacement, ...accounts.slice(1)], ownerId, personaId);
    assert.equal(decide(scoped).ok, false);
  }
});
