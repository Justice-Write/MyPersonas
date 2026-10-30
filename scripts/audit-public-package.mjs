import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Read-only inventory. This does not create a release or certify asset consent.
export function parseIncludes(workflow) {
  const block = workflow.match(/rsync -a --delete[\s\S]*?"\$\{SITE_DIR\}\/" \.pages-artifact\//)?.[0];
  if (!block || !block.includes("--exclude '*'")) throw new Error('Unrecognized Pages packaging rule');
  const rules = [...block.matchAll(/--include '([^']+)'/g)].map(m => m[1]);
  if (!rules.length || rules.some(r => !/^\/[A-Za-z0-9_.\/-]+(?:\*\*\*)?$/.test(r) || r.includes('..'))) {
    throw new Error('Unsupported include rule');
  }
  return rules;
}

export function selected(relative, rules) {
  return rules.some(rule => rule.endsWith('/***')
    ? relative.startsWith(rule.slice(1, -3))
    : !rule.endsWith('/') && relative === rule.slice(1));
}

export function risks(relative) {
  const lower = relative.toLowerCase();
  const parts = lower.split('/');
  const blocked = parts.some(p => /^\.env(?:\.|$)/.test(p) || ['.git', 'node_modules', 'status-handoff.md', 'cookies', 'login data', 'local storage', 'session storage', 'private', 'backups', 'outputs'].includes(p))
    || /\.(?:sqlite(?:3)?|db|pem|key|pfx|p12|jks|keystore|safetensors|ckpt|gguf|pt|pth)$/.test(lower);
  const review = /\.(?:zip|7z|tar|gz|exe|msi|apk|dmg)$/.test(lower)
    ? 'Embedded archive or executable requires a separate member/payload review.'
    : /\.(?:png|jpe?g|webp|gif|mp4|mp3|wav)$/.test(lower)
      ? 'Bundled media needs provenance and publication approval; a filename/hash is not consent.' : null;
  return { blocked, review };
}

async function inventory(root, filter) {
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Root must be a real directory');
  const canonical = await realpath(root);
  const rows = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      const full = path.join(dir, entry.name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Link refused: ${relative}`);
      const resolved = await realpath(full);
      const inside = path.relative(canonical, resolved);
      if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`Path escape: ${relative}`);
      if (stat.isDirectory()) await walk(full, relative + '/');
      else if (stat.isFile() && filter(relative)) {
        const bytes = await readFile(full);
        rows.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...risks(relative) });
      }
    }
  }
  await walk(root);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

export async function audit({ source, workflow, artifact }) {
  const workflowBytes = await readFile(workflow);
  const rules = parseIncludes(workflowBytes.toString('utf8'));
  const files = await inventory(source, relative => selected(relative, rules));
  const missingRequired = rules.filter(r => !r.endsWith('/') && !r.endsWith('/***'))
    .map(r => r.slice(1)).filter(r => !files.some(f => f.path === r));
  const failures = files.filter(f => f.blocked).map(f => `Forbidden package data: ${f.path}`);
  failures.push(...missingRequired.map(p => `Missing source member: ${p}`));
  if (artifact) {
    const actual = await inventory(artifact, () => true);
    const expected = new Map(files.map(f => [f.path, f]));
    for (const file of actual) {
      const match = expected.get(file.path);
      if (!match) failures.push(`Unexpected artifact member: ${file.path}`);
      else if (match.sha256 !== file.sha256) failures.push(`Changed artifact bytes: ${file.path}`);
      expected.delete(file.path);
    }
    failures.push(...[...expected.keys()].map(p => `Missing artifact member: ${p}`));
  }
  return {
    status: failures.length ? 'FAIL' : artifact ? 'BYTE_PARITY_ONLY' : 'SOURCE_INVENTORY_ONLY',
    workflowSha256: createHash('sha256').update(workflowBytes).digest('hex'),
    limits: 'Read-only snapshot. No secret-content scan, image/consent review, archive extraction, backend validation, deployment, or installation. Concurrent source changes require a fresh audit.',
    failures, reviewRequired: files.filter(f => f.review).map(f => ({ path: f.path, reason: f.review })),
    fileCount: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), files,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (![2, 3].includes(args.length)) {
    console.error('Usage: node scripts/audit-public-package.mjs SOURCE WORKFLOW [ARTIFACT]');
    process.exitCode = 2;
  } else {
    try {
      const result = await audit({ source: args[0], workflow: args[1], artifact: args[2] });
      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'FAIL') process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
