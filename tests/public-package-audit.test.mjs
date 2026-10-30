import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { audit, parseIncludes, risks, selected } from '../scripts/audit-public-package.mjs';

const workflow = `rsync -a --delete --include '/index.html' --include '/assets/' --include '/assets/***' --exclude '*' "\${SITE_DIR}/" .pages-artifact/`;
test('requires a recognized deny-default packaging block', () => {
  assert.throws(() => parseIncludes(workflow.replace("--exclude '*'", '')));
  assert.throws(() => parseIncludes(workflow.replace('/assets/***', '/**')));
  const rules = parseIncludes(workflow);
  assert.equal(selected('assets/image.png', rules), true);
  assert.equal(selected('outputs/private.json', rules), false);
  assert.equal(selected('status-handoff.md', rules), false);
});
test('personal stores and keys are blocked; archives and media require review', () => {
  for (const name of ['assets/.env.production', 'assets/secret.key', 'assets/history.db', 'assets/model.gguf', 'assets/Local Storage/x', 'assets/status-handoff.md']) assert.equal(risks(name).blocked, true, name);
  assert.ok(risks('assets/old-release.zip').review);
  assert.ok(risks('assets/avatar.png').review);
  assert.equal(risks('index.html').review, null);
});
test('actual package rejects unexpected private files, missing files and changed bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'personas-package-audit-'));
  try {
    const source = path.join(dir, 'source'), artifact = path.join(dir, 'artifact');
    await mkdir(source); await mkdir(artifact);
    await writeFile(path.join(dir, 'pages.yml'), workflow);
    await writeFile(path.join(source, 'index.html'), 'public shell');
    await writeFile(path.join(artifact, 'index.html'), 'public shell');
    await writeFile(path.join(source, 'status-handoff.md'), 'private local notes');
    const options = { source, artifact, workflow: path.join(dir, 'pages.yml') };
    assert.equal((await audit(options)).status, 'BYTE_PARITY_ONLY');
    assert.equal((await audit({ ...options, artifact: undefined })).status, 'SOURCE_INVENTORY_ONLY');
    await writeFile(path.join(artifact, 'status-handoff.md'), 'private local notes');
    assert.match((await audit(options)).failures.join('\n'), /Unexpected artifact member/);
    await rm(path.join(artifact, 'status-handoff.md'));
    await writeFile(path.join(artifact, 'index.html'), 'changed');
    assert.match((await audit(options)).failures.join('\n'), /Changed artifact bytes/);
    await rm(path.join(artifact, 'index.html'));
    assert.match((await audit(options)).failures.join('\n'), /Missing artifact member/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
