import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPackage, includesFromWorkflow } from '../scripts/verify-pages-package.mjs';

const workflow = "--include '/index.html' --include '/assets/' --exclude '/assets/legacy.zip' --exclude '/assets/retired/***' --include '/assets/***' --exclude '*'";
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'mypersonas-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'), artifact = join(root, 'artifact');
  for (const dir of [source, artifact]) {
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'index.html'), '<html>public shell</html>');
    await writeFile(join(dir, 'assets', 'icon.svg'), '<svg/>');
  }
  await writeFile(join(source, 'status-handoff.md'), 'private handoff');
  return { source, artifact };
}
test('accepts exact public payload and hashes every member; source handoff stays excluded', async t => {
  const {source, artifact} = await fixture(t);
  const result = await verifyPackage(source, artifact, workflow);
  assert.equal(result.count, 2);
  assert.ok(result.files.every(f => /^[a-f0-9]{64}$/.test(f.sha256)));
});
test('rejects missing deny-all', () => assert.throws(() => includesFromWorkflow("--include '/index.html'")));
test('honors an ordered exclusion inside an included tree', async t => {
  const {source, artifact} = await fixture(t);
  await mkdir(join(source, 'assets', 'retired'), { recursive: true });
  await writeFile(join(source, 'assets', 'retired', 'avatar.png'), 'retired');
  await writeFile(join(source, 'assets', 'legacy.zip'), 'separate app');
  const result = await verifyPackage(source, artifact, workflow);
  assert.equal(result.count, 2);
});
test('rejects extra private handoff', async t => {
  const {source, artifact} = await fixture(t);
  await writeFile(join(artifact, 'status-handoff.md'), 'private');
  await assert.rejects(verifyPackage(source, artifact, workflow), /membership mismatch/);
});
test('rejects corrupted program bytes', async t => {
  const {source, artifact} = await fixture(t);
  await writeFile(join(artifact, 'index.html'), 'changed');
  await assert.rejects(verifyPackage(source, artifact, workflow), /bytes differ/);
});
test('rejects private data even when accidentally included through assets', async t => {
  const {source, artifact} = await fixture(t);
  for (const dir of [source, artifact]) await writeFile(join(dir, 'assets', 'user.sqlite'), 'synthetic');
  await assert.rejects(verifyPackage(source, artifact, workflow), /Private data filename refused/);
});
test('rejects a missing allowed asset', async t => {
  const {source, artifact} = await fixture(t);
  await rm(join(artifact, 'assets', 'icon.svg'));
  await assert.rejects(verifyPackage(source, artifact, workflow), /missing=assets\/icon.svg/);
});
