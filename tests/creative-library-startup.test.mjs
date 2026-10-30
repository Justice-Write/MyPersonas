import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('SQL harness ignores temporary socket readiness and executes only on final TCP server', () => {
  const harness = fileURLToPath(new URL('../scripts/test-creative-library-sql.ps1', import.meta.url));
  const script = `
    $ErrorActionPreference = 'Stop'
    $global:readyProbes = 0
    $global:sqlCalls = 0
    $global:removed = $false
    function Start-Sleep { }
    function docker {
      $a = @($args)
      $global:LASTEXITCODE = 0
      if ($a[0] -eq 'ps') { return }
      if ($a[0] -eq 'run') { return 'synthetic-container' }
      if ($a[0] -eq 'rm') { $global:removed = $true; return }
      if ($a -contains 'pg_isready') {
        $global:readyProbes += 1
        # A Unix socket is ready immediately, then disappears during init.
        if ($a -notcontains '127.0.0.1') { return }
        if ($global:readyProbes -lt 3) { $global:LASTEXITCODE = 1 }
        return
      }
      if ($a -contains 'psql') {
        if ($global:readyProbes -lt 3) { throw 'Seed reached temporary initialization server' }
        if ($a -notcontains '127.0.0.1' -or $a -notcontains 'PGPASSWORD=postgres') { throw 'Seed did not use final authenticated TCP endpoint' }
        $global:sqlCalls += 1
        return
      }
      throw 'Unexpected Docker command; no external process is permitted'
    }
    . $env:PERSONAS_SQL_HARNESS_UNDER_TEST
    if ($global:sqlCalls -ne 4 -or -not $global:removed) { throw 'SQL sequence or owned cleanup incomplete' }
    Write-Output 'MOCK_LIFECYCLE_PASS'
  `;
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', timeout: 30000, windowsHide: true,
    env: { ...process.env, PERSONAS_SQL_HARNESS_UNDER_TEST: path.resolve(harness) },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stdout, /MOCK_LIFECYCLE_PASS/);
});
