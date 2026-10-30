import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const privateName = /(^|\/)(?:status-handoff\.md|\.env(?:\..*)?|[^/]*\.(?:pem|key|p12|pfx|jks|keystore|sqlite(?:3)?|db|bundle)|(?:credentials|casting-tracker|owner-mobile-prefs)\.[^/]+)$/i;

export function includesFromWorkflow(text) {
  const rules = [...text.matchAll(/--include '\/([^']+)'/g)].map(m => m[1]);
  if (!rules.length || !text.includes("--exclude '*'")) throw new Error('Missing deny-by-default Pages allowlist');
  return rules;
}

export function isIncluded(name, rules) {
  return rules.some(rule => rule.endsWith('/***') ? name.startsWith(rule.slice(0, -3)) : name === rule);
}

async function files(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const stat = await lstat(resolve(root, name));
    if (stat.isSymbolicLink()) throw new Error(`Symlink refused: ${name}`);
    if (stat.isDirectory()) result.push(...await files(root, name));
    else if (stat.isFile()) result.push(name);
    else throw new Error(`Unsupported file type: ${name}`);
  }
  return result.sort();
}

export async function verifyPackage(source, artifact, workflow) {
  const rules = includesFromWorkflow(workflow);
  const sourceFiles = await files(source);
  const expected = sourceFiles.filter(name => isIncluded(name, rules));
  const actual = await files(artifact);
  if (!expected.includes('index.html')) throw new Error('Required index.html missing');
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length) throw new Error(`Package membership mismatch: missing=${missing.join(',')} extra=${extra.join(',')}`);
  const payload = [];
  for (const name of actual) {
    if (privateName.test(name)) throw new Error(`Private data filename refused: ${name}`);
    const original = await readFile(resolve(source, name));
    const packed = await readFile(resolve(artifact, name));
    if (!original.equals(packed)) throw new Error(`Package bytes differ: ${name}`);
    payload.push({ path: name, bytes: packed.length, sha256: createHash('sha256').update(packed).digest('hex') });
  }
  return { schema: 'mypersonas-pages-package-v1', files: payload, count: payload.length,
    limitations: 'Filename and exact-source audit; not a content review, credential scan, signed-in acceptance or deployment approval.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const artifact = process.argv[2];
  if (!artifact) throw new Error('Usage: node scripts/verify-pages-package.mjs ARTIFACT_DIRECTORY');
  const root = resolve(import.meta.dirname, '..');
  const target = resolve(artifact);
  if (relative(root, target).split(sep).includes('.git')) throw new Error('Git internals are not an artifact');
  const workflow = await readFile(resolve(root, '.github/workflows/pages.yml'), 'utf8');
  console.log(JSON.stringify(await verifyPackage(resolve(root, 'MyPersonas.Online_v0'), target, workflow), null, 2));
}
