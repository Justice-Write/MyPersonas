import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../MyPersonas.Online_v0/persona-view.js', import.meta.url), 'utf8');
const start = source.indexOf('async function personaModeRequestFriend(');
const end = source.indexOf('async function personaModeRespondFriend(', start);
assert.ok(start >= 0 && end > start);

function fixture(mode = 'invite_proof') {
  const calls = [], notices = [];
  let current = true, finish;
  const opened = new Promise(resolve => { finish = resolve; });
  let answer;
  const context = vm.createContext({
    resolveSocialActor: async () => ({ id: 'actor-a' }),
    publicInteractionPersonas: () => [],
    socialActionSnapshotCurrent: () => current,
    appPrompt: (...args) => { finish(args); return new Promise(resolve => { answer = resolve; }); },
    sb: { rpc: async (name, args) => {
      calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
      return name === 'public_persona_friend_policy'
        ? { data: [{ request_mode: mode }] }
        : { data: { ok: true, message: 'Requested' } };
    } },
    toast: message => notices.push(message),
    route: () => notices.push('routed'),
  });
  vm.runInContext(source.slice(start, end), context);
  return { calls, notices, opened, run: () => context.personaModeRequestFriend('target-b'), answer: value => answer(value), invalidate: () => { current = false; } };
}

test('friend invite waits for input and sends the trimmed proof for the captured actor and target', async () => {
  const f = fixture(), pending = f.run();
  const args = await f.opened;
  assert.equal(args[2].confirmLabel, 'Send friend request');
  assert.equal(f.calls.length, 1, 'no mutation while the prompt is open');
  f.answer('  synthetic-proof  ');
  await pending;
  assert.deepEqual(f.calls[1], { name: 'persona_mode_request_friendship', args: {
    p_actor_persona_id: 'actor-a', p_target_persona_id: 'target-b', p_invite_token: 'synthetic-proof',
  } });
  assert.deepEqual(f.notices, ['Requested', 'routed']);
});

for (const answer of [null, '', '   ']) {
  test(`friend invite cancellation or blank input causes no mutation: ${JSON.stringify(answer)}`, async () => {
    const f = fixture(), pending = f.run();
    await f.opened; f.answer(answer); await pending;
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.notices, []);
  });
}

test('switching the actor or owner during input cancels the pending friend request', async () => {
  const f = fixture(), pending = f.run();
  await f.opened; f.invalidate(); f.answer('synthetic-proof'); await pending;
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.notices, []);
});

test('open friendship policy still sends without an invite prompt', async () => {
  const f = fixture('open'); await f.run();
  assert.equal(f.calls[1].args.p_invite_token, null);
});

test('unsupported contact proof remains blocked without a prompt or mutation', async () => {
  const f = fixture('contact_proof'); await f.run();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.notices, ['Private contact proof is not configured yet']);
});
