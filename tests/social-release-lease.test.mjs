import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateLease, validateHoldingRun, validateConsumerClaim, workflowPathMatches, selectConsumer, verifyDownloadedSource, checkActiveBackend, EXPECTED, HOLD_STEP, LEASE_WORKFLOW } from '../scripts/social-release-lease.mjs';

const pin = 'a'.repeat(40), socialSha = 'b'.repeat(40), now = Date.parse('2026-11-02T22:00:10Z');
const receipt = () => ({ schema: 'mypersonas-social-release-lease-v1', workflow: LEASE_WORKFLOW, pin, socialSha, backendRun: '12', leaseRun: '34', leaseAttempt: 1, issuedAt: '2026-11-02T22:00:00Z', backend: Object.entries(EXPECTED).map(([slug, files]) => ({ slug, verifyJwt: true, files: files.map(path => ({ path, sha256: 'c'.repeat(64) })) })) });
const options = () => ({ pin, socialSha, backendRun: '12', leaseRun: '34', now, consumerCreatedAt: '2026-11-02T22:00:01Z', attempt: '1' });
const active = () => ({ id: 34, head_sha: pin, head_branch: 'main', event: 'workflow_dispatch', status: 'in_progress', run_attempt: 1, path: LEASE_WORKFLOW });
const jobs = () => [{ status: 'in_progress', steps: [{ name: HOLD_STEP, status: 'in_progress' }] }];
const consumer = () => ({ id: 56, display_title: 'AliaSpaces social release lease 34', head_sha: socialSha, head_branch: 'main', event: 'workflow_dispatch', path: '.github/workflows/pages.yml', run_attempt: 1, created_at: '2026-11-02T22:00:01Z', status: 'in_progress' });

test('lease binds distinct repositories and the active code attestation', () => assert.equal(validateLease(receipt(), options()), true));
for (const [name, change] of Object.entries({ 'wrong upstream': r => r.pin = 'd'.repeat(40), 'wrong social': r => r.socialSha = 'd'.repeat(40), 'historical backend': r => r.backendRun = '99', 'other lease': r => r.leaseRun = '99', 'wrong workflow': r => r.workflow = '.github/workflows/ci.yml', 'rerun lease': r => r.leaseAttempt = 2, 'missing backend': r => r.backend = [], 'JWT disabled': r => r.backend[0].verifyJwt = false, 'missing source member': r => r.backend[0].files.pop(), 'duplicate source member': r => r.backend[0].files[0] = r.backend[0].files[1] })) {
  test(`reject lease with ${name}`, () => { const r = receipt(); change(r); assert.throws(() => validateLease(r, options())); });
}
test('reject consumer replay, expired admission and invalid creation time', () => {
  for (const patch of [{ attempt: '2' }, { consumerCreatedAt: '2026-11-02T21:59:59Z' }, { consumerCreatedAt: '2026-11-02T22:10:01Z' }, { consumerCreatedAt: 'bad' }, { now: now + 46 * 60_000 }]) assert.throws(() => validateLease(receipt(), { ...options(), ...patch }));
});
test('queued run cannot borrow a lease when its job starts after admission', () => {
  assert.throws(() => validateLease(receipt(), { ...options(), consumerStartedAt: '2026-11-02T22:39:00Z', now: now + 39 * 60_000 }), /job started/);
  assert.equal(validateLease(receipt(), { ...options(), consumerStartedAt: '2026-11-02T22:09:59Z', now: now + 25 * 60_000 }), true);
});
test('second or rerun consumer cannot use the sole upstream-issued claim', () => {
  const claim = { schema: 'mypersonas-social-release-consumer-v1', leaseRun: '34', consumerRun: 56, consumerAttempt: 1 };
  assert.equal(validateConsumerClaim(claim, receipt(), consumer()), true);
  assert.throws(() => validateConsumerClaim(claim, receipt(), { ...consumer(), id: 57 }), /different consumer/);
  assert.throws(() => validateConsumerClaim(claim, receipt(), { ...consumer(), run_attempt: 2 }), /rerun/);
});
test('workflow paths permit only exact main suffix, never arbitrary refs', () => {
  assert.equal(workflowPathMatches(LEASE_WORKFLOW, LEASE_WORKFLOW), true);
  assert.equal(workflowPathMatches(LEASE_WORKFLOW + '@refs/heads/main', LEASE_WORKFLOW), true);
  assert.equal(workflowPathMatches(LEASE_WORKFLOW + '@refs/heads/other', LEASE_WORKFLOW), false);
  assert.equal(validateHoldingRun({ ...active(), path: LEASE_WORKFLOW + '@refs/heads/main' }, jobs(), options()), true);
});
test('reject queued, completed, canceled, foreign branch or rerun upstream workflow', () => {
  for (const patch of [{ status: 'queued' }, { status: 'completed', conclusion: 'success' }, { status: 'cancelled' }, { head_branch: 'other' }, { run_attempt: 2 }, { path: '.github/workflows/supabase-deploy.yml' }, { head_sha: socialSha }]) assert.throws(() => validateHoldingRun({ ...active(), ...patch }, jobs(), options()));
  assert.equal(validateHoldingRun(active(), jobs(), options()), true);
});
test('in-progress workflow alone is insufficient: only the actual holding step admits publication', () => {
  for (const candidate of [[], [{ status: 'in_progress', steps: [] }], [{ status: 'in_progress', steps: [{ name: HOLD_STEP, status: 'queued' }] }], [{ status: 'completed', steps: [{ name: HOLD_STEP, status: 'completed' }] }]]) assert.throws(() => validateHoldingRun(active(), candidate, options()));
});
test('select only one exact newly admitted consumer; refuse ambiguity', () => {
  assert.equal(selectConsumer([consumer()], receipt()).id, 56);
  for (const patch of [{ display_title: 'other' }, { run_attempt: 2 }, { head_sha: pin }, { created_at: '2026-11-02T21:00:00Z' }, { created_at: '2026-11-02T22:11:00Z' }, { event: 'push' }, { head_branch: 'staging' }]) assert.equal(selectConsumer([{ ...consumer(), ...patch }], receipt()), null);
  assert.throws(() => selectConsumer([consumer(), { ...consumer(), id: 57 }], receipt()), /multiple/);
});
test('source comparison catches replaced functions despite an unchanged successful historical receipt', () => {
  const slug = 'compose-post', original = Object.fromEntries(EXPECTED[slug].map(name => [name, `// ${name}\nconst same = true;\n`]));
  const metadata = { slug, verify_jwt: true, status: 'ACTIVE', version: 6 };
  assert.equal(verifyDownloadedSource(slug, original, original, metadata).files.length, 2);
  const crlf = Object.fromEntries(Object.entries(original).map(([n, s]) => [n, s.replaceAll('\n', '\r\n')]));
  assert.equal(verifyDownloadedSource(slug, crlf, original, metadata).verifyJwt, true);
  assert.throws(() => verifyDownloadedSource(slug, { ...original, 'compose-post/index.ts': 'old backend' }, original, metadata), /source mismatch/);
  assert.throws(() => verifyDownloadedSource(slug, original, original, { ...metadata, verify_jwt: false }), /JWT/);
  assert.throws(() => verifyDownloadedSource(slug, { ...original, 'extra.ts': 'unreviewed' }, original, metadata), /membership/);
});
test('readback uses isolated download roots, requires six exact source files and omits credentials from receipt', async () => {
  const source = fileURLToPath(new URL('../', import.meta.url)), roots = [];
  const fetchImpl = async url => {
    assert.match(url, /^https:\/\/api.supabase.com\/v1\/projects\/[a-z]{20}\/functions$/);
    return { ok: true, json: async () => Object.keys(EXPECTED).map(slug => ({ slug, status: 'ACTIVE', verify_jwt: true, version: 1 })) };
  };
  const download = async ({ slug, folder }) => {
    roots.push(folder);
    assert.ok(!folder.startsWith(source));
    for (const name of EXPECTED[slug]) {
      const target = path.join(folder, 'supabase/functions', name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, execFileSync('git', ['-C', source, 'show', `HEAD:supabase/functions/${name}`]));
    }
  };
  const result = await checkActiveBackend({ source, token: 'synthetic-not-a-credential', fetchImpl, download });
  assert.equal(result.flatMap(entry => entry.files).length, 6);
  assert.equal(new Set(roots).size, 2);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-not-a-credential|Bearer|index.ts.*const /);
});
test('backend and both upstream release workflows hold the same repository lock; consumer lifetime is shorter', async () => {
  const read = name => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
  for (const name of ['supabase-deploy.yml', 'pages.yml', 'social-release-lease.yml']) assert.match(await read(name), /group: production-release/);
  const lease = await read('social-release-lease.yml');
  assert.match(lease, /cancel-in-progress: false/);
  assert.match(lease, /timeout-minutes: 60/);
  assert.match(lease, /version: 2\.115\.0/);
  assert.ok(lease.indexOf('social-release-lease.mjs issue') < lease.indexOf('actions/upload-artifact@'));
  const pages = await read('pages.yml');
  assert.ok(pages.indexOf('check-backend --source .') < pages.indexOf('uses: actions/deploy-pages@'));
});
