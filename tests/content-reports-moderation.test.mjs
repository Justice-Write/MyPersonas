import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (value) => readFile(path.join(root, value), "utf8");
const migrationPath = "MyPersonas.Online_v0/sql-updates/080-content-reports-moderation-queue.sql";
const mirrorPath = "supabase/migrations/20261016180000_content_reports_moderation_queue.sql";
const fn = (sql, name) => sql.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`))?.[0] || "";

test("content report migration and timestamped mirror remain identical and transactional", async () => {
  const [migration, mirror] = await Promise.all([read(migrationPath), read(mirrorPath)]);
  assert.equal(mirror, migration);
  assert.match(migration, /^-- 080-content-reports-moderation-queue\.sql/);
  assert.match(migration, /\nbegin;[\s\S]*\ncommit;\n$/);
});

test("report tables have RLS, no policies and no client grants", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /alter table public\.content_reports enable row level security/);
  assert.match(sql, /alter table public\.content_report_events enable row level security/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(sql, /revoke all on public\.content_reports, public\.content_report_events from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.content_report/i);
});

test("every function is security definer with an empty search_path and no anon execute", async () => {
  const sql = await read(migrationPath);
  for (const name of ["report_content", "staff_list_content_reports", "staff_resolve_content_report"]) {
    const body = fn(sql, name);
    assert.ok(body, `${name} missing`);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to [^;]*anon`));
  }
});

test("reporting fails closed through persona_visible and never leaks existence", async () => {
  const body = fn(await read(migrationPath), "report_content");
  assert.match(body, /not public\.persona_visible\(v_target_persona\)/);
  assert.match(body, /not public\.persona_visible\(v_post_persona\)/);
  assert.equal((body.match(/Reportable content not found/g) || []).length, 1, "one generic not-found error");
  assert.match(body, /You cannot report your own content/);
  assert.match(body, /Reporting persona must be your own/);
  assert.match(body, /v_recent >= 20/);
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /'spam','harassment','impersonation','illegal','other'/);
});

test("staff queue requires an active staff role and AAL2, and resolution is audited, not destructive", async () => {
  const sql = await read(migrationPath);
  for (const name of ["staff_list_content_reports", "staff_resolve_content_report"]) {
    const body = fn(sql, name);
    assert.match(body, /has_platform_role\(array\['global_administrator','technician'\]::text\[\]\)/);
    assert.match(body, /perform public\.require_aal2\(\)/);
  }
  const resolve = fn(sql, "staff_resolve_content_report");
  assert.match(resolve, /insert into public\.content_report_events/);
  assert.match(resolve, /Report is already resolved/);
  assert.doesNotMatch(resolve, /delete from|publication_state|unpublish/i, "resolving must not take content actions");
});

test("disposable SQL runtime suite is wired up", async () => {
  const [seed, runtime, ps1, sh] = await Promise.all([
    read("tests/sql/content-reports-seed.sql"), read("tests/sql/content-reports-runtime.sql"),
    read("scripts/test-content-reports-sql.ps1"), read("scripts/test-content-reports-sql.sh"),
  ]);
  assert.match(seed, /create function public\.persona_visible/);
  assert.match(runtime, /resolve audit: passed/);
  for (const runner of [ps1, sh]) {
    assert.match(runner, /content-reports-seed\.sql/);
    assert.equal((runner.match(/20261016180000_content_reports_moderation_queue\.sql/g) || []).length, 2, "migration applied twice");
    assert.match(runner, /content-reports-runtime\.sql/);
  }
});
