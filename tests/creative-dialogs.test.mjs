import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../MyPersonas.Online_v0/' + name, import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111';

function fixture() {
  const effects = [], nodes = new Map([
    ['creativeEdit', { dataset: { assetId: 'asset-a' } }],
    ['creativeStatus', { textContent: '' }],
  ]);
  let answer, openedResolve, personaMode = false;
  const opened = new Promise(resolve => { openedResolve = resolve; });
  const ctx = vm.createContext({
    URL, session: { user: { id: owner } }, privateSessionReady: true,
    location: { hash: '#/library' }, navigator: { onLine: true }, myPersonas: [],
    ownerAppIsPersonaMode: () => personaMode,
    document: { getElementById: id => nodes.get(id) },
    appConfirm: (message, options) => {
      openedResolve({ message, options });
      return new Promise(resolve => { answer = resolve; });
    },
    sb: {
      storage: { from: bucket => ({ remove: async paths => { effects.push({ remove: [...paths], bucket }); return {}; } }) },
      from: table => ({
        insert: async row => { effects.push({ insert: JSON.parse(JSON.stringify(row)), table }); return {}; },
        delete: () => { const filters = {}; const query = {
          eq: (key, value) => { filters[key] = value; return query; },
          select: async () => { effects.push({ delete: filters, table }); return { data: [{ id: 'asset-a' }] }; },
        }; return query; },
      }),
      functions: { invoke: async (name, args) => { effects.push({ invoke: name, body: JSON.parse(JSON.stringify(args.body)) }); return { data: {} }; } },
    },
  });
  vm.runInContext(read('creative-media.js') + '\n' + read('creative-workspace.js'), ctx);
  vm.runInContext(`creativeState.assets=[{id:'asset-a',owner:${JSON.stringify(owner)},title:'Original',storage_path:'${owner}/asset-a'}];
    creativeLoadLibrary=async()=>{};renderCreativeWorkspace=async()=>{};
    var resource={url:'https://cdn.openart.ai/reference.png',mediaType:'image',title:'Original reference'};`, ctx);
  return { ctx, nodes, effects, opened, answer: value => answer(value),
    run: action => vm.runInContext(action === 'remove' ? 'creativeRemoveAsset("asset-a",creativeContext())'
      : action === 'disconnect' ? 'creativeDisconnect(creativeContext())'
      : 'creativeSaveReference(resource,creativeContext())', ctx),
    invalidate: kind => {
      if (kind === 'owner') ctx.session.user.id = 'different-owner';
      if (kind === 'route') ctx.location.hash = '#/owner';
      if (kind === 'generation') vm.runInContext('creativeState.generation++', ctx);
      if (kind === 'perspective') personaMode = true;
    },
  };
}

for (const action of ['remove', 'disconnect', 'reference']) {
  test(`${action}: cancellation performs no operation`, async () => {
    const f = fixture(), pending = f.run(action);
    const { options } = await f.opened;
    assert.equal(options.destructive, action !== 'reference');
    assert.deepEqual(f.effects, [], 'no operation while confirmation is pending');
    f.answer(false); await pending;
    assert.deepEqual(f.effects, []);
  });
  for (const kind of ['owner', 'route', 'generation', 'perspective']) {
    test(`${action}: ${kind} change while awaiting confirmation prevents the first side effect`, async () => {
      const f = fixture(), pending = f.run(action);
      await f.opened; f.invalidate(kind); f.answer(true);
      await assert.rejects(pending, /workspace changed|Switch to Overview/);
      assert.deepEqual(f.effects, []);
    });
  }
}

test('accepted removal uses only the captured private file and owner-qualified row', async () => {
  const f = fixture(), pending = f.run('remove');
  await f.opened; f.answer(true); await pending;
  assert.deepEqual(f.effects, [
    { remove: [`${owner}/asset-a`], bucket: 'creative-private' },
    { delete: { id: 'asset-a', owner }, table: 'owner_media_library' },
  ]);
});

for (const change of ['creativeState.assets[0].storage_path="replacement"', 'creativeState.assets=[]']) {
  test(`changed library entry cancels removal: ${change}`, async () => {
    const f = fixture(), pending = f.run('remove');
    await f.opened; vm.runInContext(change, f.ctx); f.answer(true);
    await assert.rejects(pending, /library entry changed/);
    assert.deepEqual(f.effects, []);
  });
}

test('switching the displayed library entry cancels removal', async () => {
  const f = fixture(), pending = f.run('remove');
  await f.opened; f.nodes.get('creativeEdit').dataset.assetId = 'other'; f.answer(true);
  await assert.rejects(pending, /library entry changed/);
  assert.deepEqual(f.effects, []);
});

test('accepted disconnect retains the existing exact endpoint and action', async () => {
  const f = fixture(), pending = f.run('disconnect');
  await f.opened; f.answer(true); await pending;
  assert.deepEqual(f.effects, [{ invoke: 'openart-connect', body: { action: 'disconnect' } }]);
});

test('accepted reference uses a captured resource and stays private, unreviewed and training-disabled', async () => {
  const f = fixture(), pending = f.run('reference');
  await f.opened;
  vm.runInContext('resource.title="Changed";resource.mediaType="video";resource.url="https://cdn.openart.ai/other.png"', f.ctx);
  f.answer(true); await pending;
  assert.equal(f.effects.length, 1);
  const { insert } = f.effects[0];
  assert.equal(insert.title, 'Original reference');
  assert.equal(insert.source_url, 'https://cdn.openart.ai/reference.png');
  assert.equal(insert.kind, 'image');
  assert.equal(insert.owner, owner);
  assert.equal(insert.training_allowed, false);
  assert.equal(insert.review_status, 'unreviewed');
});
