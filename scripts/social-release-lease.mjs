// Shared upstream lock / downstream consumer contract. No deployment or model calls.
import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const LEASE_WORKFLOW = '.github/workflows/social-release-lease.yml';
export const HOLD_STEP = 'Hold upstream lock until AliaSpaces completes';
export const CONSUMER_TIMEOUT_MINUTES = 20;
export const ADMISSION_MS = 10 * 60_000;
export const EXPECTED = Object.freeze({
  'ai-proxy': ['ai-proxy/index.ts', '_shared/image-caption-drafting.ts', '_shared/local-fleet.ts', '_shared/fleet-protocol.ts'],
  'compose-post': ['compose-post/index.ts', '_shared/image-caption-drafting.ts'],
});
const shaPattern = /^[a-f0-9]{40}$/;
const idPattern = /^[1-9][0-9]*$/;
export const workflowPathMatches = (actual, expected) => actual === expected || actual === `${expected}@refs/heads/main`;
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = value => String(value).replace(/\r\n/g, '\n');
const requireThat = (test, message) => { if (!test) throw new Error(message); };

export function validateLease(receipt, { pin, socialSha, backendRun, leaseRun, now = Date.now(), consumerCreatedAt, consumerStartedAt = consumerCreatedAt, attempt = '1' }) {
  requireThat(shaPattern.test(pin) && shaPattern.test(socialSha), 'Invalid release SHA');
  requireThat([backendRun, leaseRun].every(value => idPattern.test(String(value))), 'Invalid release run');
  requireThat(String(attempt) === '1', 'Start a new consumer run; a lease cannot be reused by a rerun');
  requireThat(receipt.schema === 'mypersonas-social-release-lease-v1' && receipt.workflow === LEASE_WORKFLOW, 'Unknown lease contract');
  requireThat(receipt.pin === pin && receipt.socialSha === socialSha && String(receipt.backendRun) === String(backendRun) && String(receipt.leaseRun) === String(leaseRun), 'Lease does not bind this exact release');
  requireThat(receipt.leaseAttempt === 1, 'A rerun is not a fresh lease');
  const issued = Math.floor(Date.parse(receipt.issuedAt) / 1000) * 1000, created = Date.parse(consumerCreatedAt), started = Date.parse(consumerStartedAt);
  requireThat(Number.isFinite(issued) && Number.isFinite(created) && created >= issued && created <= issued + ADMISSION_MS && now >= issued && now - issued < 45 * 60_000, 'Consumer is outside the bounded lease admission/lifetime');
  requireThat(Number.isFinite(started) && started >= issued && started <= issued + ADMISSION_MS, 'Consumer job started outside the bounded admission window');
  requireThat(Array.isArray(receipt.backend) && receipt.backend.length === 2 && Object.keys(EXPECTED).every(slug => receipt.backend.some(entry => entry.slug === slug && entry.verifyJwt === true && entry.files?.length === EXPECTED[slug].length && entry.files.every(file => EXPECTED[slug].includes(file.path) && /^[a-f0-9]{64}$/.test(file.sha256)) && new Set(entry.files.map(file => file.path)).size === EXPECTED[slug].length)), 'Missing active-backend source attestation');
  return true;
}

export function validateHoldingRun(run, jobs, { pin, leaseRun }) {
  requireThat(String(run.id) === String(leaseRun) && run.head_sha === pin && run.head_branch === 'main' && run.event === 'workflow_dispatch' && run.status === 'in_progress' && run.run_attempt === 1 && workflowPathMatches(run.path, LEASE_WORKFLOW), 'Upstream lease is not the expected active main workflow');
  requireThat(jobs.some(job => job.status === 'in_progress' && job.steps?.some(step => step.name === HOLD_STEP && step.status === 'in_progress')), 'Upstream lease has not acquired/held the release lock');
  return true;
}

export function validateConsumerClaim(claim, receipt, consumer) {
  requireThat(claim.schema === 'mypersonas-social-release-consumer-v1' && String(claim.leaseRun) === String(receipt.leaseRun) && String(claim.consumerRun) === String(consumer.id) && claim.consumerAttempt === 1 && consumer.run_attempt === 1, 'Lease is bound to a different consumer or rerun');
  return true;
}

export function selectConsumer(runs, receipt) {
  const title = `AliaSpaces social release lease ${receipt.leaseRun}`;
  const candidates = runs.filter(run => run.display_title === title && run.head_sha === receipt.socialSha && run.head_branch === 'main' && run.event === 'workflow_dispatch' && workflowPathMatches(run.path, '.github/workflows/pages.yml') && run.run_attempt === 1 && Date.parse(run.created_at) >= Date.parse(receipt.issuedAt) && Date.parse(run.created_at) <= Date.parse(receipt.issuedAt) + ADMISSION_MS);
  requireThat(candidates.length <= 1, 'Lease has multiple consumers; release requires investigation');
  return candidates[0] || null;
}

export function verifyDownloadedSource(slug, files, expectedSource, metadata) {
  requireThat(metadata?.slug === slug && metadata.verify_jwt === true && metadata.status === 'ACTIVE', 'Active backend identity/JWT mismatch');
  const wanted = EXPECTED[slug];
  requireThat(wanted && Object.keys(files).length === wanted.length && wanted.every(name => Object.hasOwn(files, name)), 'Downloaded backend membership mismatch');
  return { slug, version: metadata.version, verifyJwt: true, files: wanted.map(name => {
    const actual = normalize(files[name]);
    requireThat(actual === normalize(expectedSource[name]), `Active backend source mismatch: ${slug}/${name}`);
    return { path: name, sha256: hash(actual) };
  }) };
}

export async function github(endpoint, { fetchImpl = fetch } = {}) {
  requireThat(/^[A-Za-z0-9_./?=&-]+$/.test(endpoint), 'Invalid GitHub endpoint');
  const result = await fetchImpl(`https://api.github.com/${endpoint}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN || ''}`, 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30_000) });
  requireThat(result.ok, `GitHub release read failed (${result.status})`);
  return result.json();
}

export async function checkActiveBackend({ source = '.', token = process.env.SUPABASE_ACCESS_TOKEN, fetchImpl = fetch, download } = {}) {
  requireThat(!!token, 'Active-backend verification requires the existing deployment credential');
  const config = await readFile(path.join(source, 'supabase/config.toml'), 'utf8');
  const ref = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
  requireThat(!!ref, 'Invalid pinned project ref');
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/functions`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  requireThat(response.ok, `Active-backend metadata read failed (${response.status})`);
  const metadata = await response.json();
  requireThat(Array.isArray(metadata), 'Unexpected backend metadata format');
  const results = [];
  for (const slug of Object.keys(EXPECTED)) {
    const folder = await mkdtemp(path.join(tmpdir(), 'mypersonas-backend-readback-'));
    try {
      await mkdir(path.join(folder, 'supabase'), { recursive: true });
      if (download) await download({ slug, ref, folder });
      else {
        try { execFileSync('supabase', ['functions', 'download', slug, '--project-ref', ref, '--use-api', '--workdir', folder, '--yes'], { stdio: 'pipe', timeout: 120_000, env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } }); }
        catch { throw new Error(`Active backend download failed: ${slug}`); }
      }
      const root = path.join(folder, 'supabase/functions'), files = {};
      const walk = async (directory, relative = '') => {
        for (const item of await readdir(directory, { withFileTypes: true })) {
          const name = relative + item.name;
          if (item.isDirectory()) await walk(path.join(directory, item.name), name + '/');
          else { requireThat(item.isFile() && !item.isSymbolicLink(), 'Nonregular backend source'); files[name] = await readFile(path.join(directory, item.name), 'utf8'); }
        }
      };
      await walk(root);
      const expected = Object.fromEntries(EXPECTED[slug].map(name => [name, execFileSync('git', ['-C', source, 'show', `HEAD:supabase/functions/${name}`], { encoding: 'utf8' })]));
      results.push(verifyDownloadedSource(slug, files, expected, metadata.find(row => row.slug === slug)));
    } finally { await rm(folder, { recursive: true, force: true }); }
  }
  return results;
}

async function main(args) {
  const value = flag => args[args.indexOf(flag) + 1];
  const mode = args[0];
  if (mode === 'check-backend') {
    const backend = await checkActiveBackend({ source: value('--source') });
    await writeFile(value('--out'), JSON.stringify(backend, null, 2) + '\n');
    console.log('Active backend source/JWT verification passed (six files)');
  } else if (mode === 'issue') {
    const pin = process.env.GITHUB_SHA, socialSha = process.env.SOCIAL_SHA, backendRun = process.env.BACKEND_RUN_ID, leaseRun = process.env.GITHUB_RUN_ID;
    requireThat(shaPattern.test(pin || '') && shaPattern.test(socialSha || '') && idPattern.test(backendRun || '') && idPattern.test(leaseRun || '') && process.env.GITHUB_RUN_ATTEMPT === '1', 'Invalid exact release inputs');
    const upstream = await github('repos/Justice-Write/MyPersonas/git/ref/heads/main');
    const social = await github('repos/Justice-Write/aliaspaces.com/git/ref/heads/main');
    requireThat(upstream.object.sha === pin && social.object.sha === socialSha, 'Release main revision moved');
    const run = await github(`repos/Justice-Write/MyPersonas/actions/runs/${backendRun}`);
    requireThat(run.status === 'completed' && run.conclusion === 'success' && run.head_sha === pin && run.head_branch === 'main' && run.event === 'workflow_dispatch' && workflowPathMatches(run.path, '.github/workflows/supabase-deploy.yml'), 'Backend workflow does not match exact successful main revision');
    const backend = await checkActiveBackend();
    const receipt = { schema: 'mypersonas-social-release-lease-v1', workflow: LEASE_WORKFLOW, pin, socialSha, backendRun, leaseRun, leaseAttempt: 1, issuedAt: new Date().toISOString(), backend };
    await mkdir('.release-lease', { recursive: true });
    await writeFile('.release-lease/lease.json', JSON.stringify(receipt, null, 2) + '\n');
    console.log('Lease binds both exact revisions and active backend source; no inference performed');
  } else if (mode === 'verify-consumer') {
    const receipt = JSON.parse(await readFile(value('--receipt'), 'utf8'));
    const options = { pin: value('--pin'), socialSha: process.env.GITHUB_SHA, backendRun: process.env.BACKEND_RUN_ID, leaseRun: process.env.UPSTREAM_RELEASE_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT };
    const consumer = await github(`repos/Justice-Write/aliaspaces.com/actions/runs/${process.env.GITHUB_RUN_ID}`);
    const consumerJobs = await github(`repos/Justice-Write/aliaspaces.com/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=latest&per_page=100`);
    const started = consumerJobs.jobs.find(job => job.name === 'deploy' && job.status === 'in_progress')?.started_at;
    const claim = JSON.parse(await readFile(path.join(path.dirname(value('--receipt')), 'consumer.json'), 'utf8'));
    validateConsumerClaim(claim, receipt, consumer);
    validateLease(receipt, { ...options, consumerCreatedAt: consumer.created_at, consumerStartedAt: started || 'invalid' });
    const run = await github(`repos/Justice-Write/MyPersonas/actions/runs/${options.leaseRun}`);
    const jobs = await github(`repos/Justice-Write/MyPersonas/actions/runs/${options.leaseRun}/jobs?filter=latest&per_page=100`);
    validateHoldingRun(run, jobs.jobs, options);
    console.log('Exact upstream release lock is held for this AliaSpaces consumer');
  } else if (mode === 'claim') {
    const receipt = JSON.parse(await readFile('.release-lease/lease.json', 'utf8'));
    while (Date.now() <= Date.parse(receipt.issuedAt) + ADMISSION_MS + 60_000) {
      const page = await github('repos/Justice-Write/aliaspaces.com/actions/workflows/pages.yml/runs?event=workflow_dispatch&per_page=100');
      const consumer = selectConsumer(page.workflow_runs, receipt);
      if (consumer) {
        await writeFile('.release-lease/consumer.json', JSON.stringify({ schema: 'mypersonas-social-release-consumer-v1', leaseRun: receipt.leaseRun, consumerRun: consumer.id, consumerAttempt: 1 }, null, 2) + '\n');
        console.log(`Lease claimed by sole consumer ${consumer.id}`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('No consumer admitted before deadline; no publication claim was issued');
  } else if (mode === 'wait-claim') {
    const runId = process.env.UPSTREAM_RELEASE_RUN_ID;
    requireThat(idPattern.test(runId || ''), 'Invalid lease run');
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const run = await github(`repos/Justice-Write/MyPersonas/actions/runs/${runId}`);
      requireThat(run.status === 'in_progress' && run.run_attempt === 1, 'Lease stopped before consumer admission');
      const jobs = await github(`repos/Justice-Write/MyPersonas/actions/runs/${runId}/jobs?filter=latest&per_page=100`);
      const artifacts = await github(`repos/Justice-Write/MyPersonas/actions/runs/${runId}/artifacts?per_page=100`);
      if (jobs.jobs.some(job => job.steps?.some(step => step.name === HOLD_STEP && step.status === 'in_progress')) && artifacts.artifacts.some(item => item.name === `social-release-consumer-${runId}` && !item.expired)) return;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('No held exact-consumer claim became available');
  } else if (mode === 'hold') {
    const receipt = JSON.parse(await readFile('.release-lease/lease.json', 'utf8'));
    const claim = JSON.parse(await readFile('.release-lease/consumer.json', 'utf8'));
    // Only this claimed run can publish. Admission10min + job20min < hold40min < workflow60min.
    const deadline = Date.now() + 40 * 60_000;
    while (Date.now() < deadline) {
      let candidate;
      try { candidate = await github(`repos/Justice-Write/aliaspaces.com/actions/runs/${claim.consumerRun}`); }
      catch { console.log('Release control-plane read unavailable; retaining upstream lock'); }
      if (candidate?.status === 'completed') {
        validateConsumerClaim(claim, receipt, candidate);
        requireThat(candidate.conclusion === 'success', 'AliaSpaces consumer did not succeed');
        await checkActiveBackend();
        console.log(`AliaSpaces consumer ${candidate.id} completed; final backend source still matches`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
    throw new Error('Lease deadline elapsed after the consumer timeout safety margin; inspect release before retrying');
  } else throw new Error('Expected check-backend, issue, claim, wait-claim, verify-consumer or hold');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
