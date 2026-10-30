import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (value) => readFile(path.join(root, value), "utf8");
const migrationPath = "MyPersonas.Online_v0/sql-updates/080-content-reports-moderation-queue.sql";
const mirrorPath = "supabase/migrations/20261016180000_content_reports_moderation_queue.sql";
const draftPath = "MyPersonas.Online_v0/sql-updates/081-content-moderation-holds.DRAFT.sql";
const REASONS = [
  "spam", "harassment", "hate", "sexual_content", "violence", "self_harm",
  "impersonation", "privacy", "intellectual_property", "illegal", "other",
];

function functions(sql) {
  const out = {};
  const pattern = /create or replace function ((?:public|moderation_private)\.[a-z_]+)\(([\s\S]*?)\)\s*returns[\s\S]*?\nas \$\$([\s\S]*?)\n\$\$;/g;
  for (const match of sql.matchAll(pattern)) {
    const header = sql.slice(match.index, match.index + match[0].indexOf("as $$"));
    out[match[1]] = { header, body: match[3] };
  }
  return out;
}

test("080 and its timestamped mirror are identical and transactional; 081 stays a draft", async () => {
  const [migration, mirror, draft] = await Promise.all([read(migrationPath), read(mirrorPath), read(draftPath)]);
  assert.equal(mirror, migration);
  assert.match(migration, /^-- 080-content-reports-moderation-queue\.sql/);
  assert.match(migration, /\nbegin;[\s\S]*\ncommit;\n$/);
  assert.match(draft, /^-- 081-content-moderation-holds\.DRAFT\.sql\n-- STATUS: DRAFT/);
  assert.match(draft, /\nbegin;[\s\S]*\ncommit;\n$/);
  const pairs = await read("tests/migration-release-parity.test.mjs");
  assert.doesNotMatch(pairs, /081-content-moderation-holds/, "the draft is never mirrored");
});

test("report tables have RLS, no policies and no client grants", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /alter table public\.content_reports enable row level security/);
  assert.match(sql, /alter table public\.content_report_events enable row level security/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(sql, /revoke all on public\.content_reports, public\.content_report_events\n  from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on public\.content_report[^;]*to (anon|authenticated)/i);
  assert.doesNotMatch(sql, /references public\.personas\(id\) on delete cascade/, "evidence never cascades away with the target");
  assert.match(sql, /reporter\s+uuid references public\.profiles\(id\) on delete set null/);
});

test("every SECURITY DEFINER function pins search_path; helpers are private; anon gets nothing it should not", async () => {
  for (const file of [migrationPath, draftPath]) {
    const sql = await read(file);
    const defs = functions(sql);
    assert.ok(Object.keys(defs).length >= 3, `${file} defines functions`);
    for (const [name, fn] of Object.entries(defs)) {
      if (/security definer/.test(fn.header)) assert.match(fn.header, /set search_path = ''/, `${name} pins search_path`);
      if (name.startsWith("moderation_private.") && name !== "moderation_private.content_held") {
        assert.match(sql, new RegExp(`revoke all on function[^;]*${name.replace(".", "\\.")}\\(`), `${name} revoked from Data API roles`);
      }
    }
    const anonGrants = [...sql.matchAll(/grant execute on function ((?:public|moderation_private)\.[a-z_]+)\([^)]*\)\s*to ([a-z_, ]+);/g)]
      .filter((match) => /\banon\b/.test(match[2])).map((match) => match[1]);
    assert.deepEqual(anonGrants.filter((fn) => !["moderation_private.content_held", "public.content_visibility_state"].includes(fn)), [],
      `${file}: only the RLS predicate and the viewer-state read reach anon`);
    assert.doesNotMatch(sql, /grant usage on schema moderation_private/, `${file}: no Data API role may name moderation_private`);
  }
});

test("reporting: session required, private reachability, one not-found error, no self-reports, limits", async () => {
  const defs = functions(await read(migrationPath));
  const report = defs["public.report_content"].body;
  assert.match(report, /raise exception 'Authentication required'/);
  assert.match(report, /moderation_private\.report_persona_reachable/);
  assert.equal((report.match(/'Reported content was not found'/g) || []).length, 1, "one generic not-found error");
  assert.match(report, /You cannot report your own content/);
  assert.match(report, /Acting persona must be yours/);
  assert.match(report, /v_hour >= 20 or v_day >= 100/);
  assert.match(report, /pg_advisory_xact_lock/);
  assert.match(report, /exception when unique_violation/);
  assert.doesNotMatch(report, /'target_owner'/, "reporter output never names the target owner");
  const reachable = defs["moderation_private.persona_viewable_ignoring_own_rule"].body;
  assert.match(reachable, /blocked\.blocker = persona\.owner and blocked\.kind = 'block'/, "the author's block still applies");
  assert.match(reachable, /persona_publication_dependencies/);
});

test("report reasons are one list everywhere", async () => {
  const [migration, draft] = await Promise.all([read(migrationPath), read(draftPath)]);
  for (const sql of [migration, draft]) {
    for (const match of sql.matchAll(/'spam','harassment'[^)]*'other'/g)) {
      assert.deepEqual([...match[0].matchAll(/'([a-z_]+)'/g)].map((item) => item[1]), REASONS);
    }
  }
});

test("staff RPCs require a staff role, AAL2 and recusal, and never take content actions", async () => {
  const defs = { ...functions(await read(migrationPath)), ...functions(await read(draftPath)) };
  for (const name of ["public.staff_list_content_reports", "public.staff_review_content_report", "public.staff_set_content_hold"]) {
    assert.ok(defs[name], `${name} defined`);
    assert.match(defs[name].body, /has_platform_role\(array\['global_administrator','technician'\]::text\[\]\)/);
    assert.match(defs[name].body, /perform public\.require_aal2\(\);/);
  }
  assert.match(defs["public.staff_list_content_reports"].body, /report\.target_owner is distinct from auth\.uid\(\)/);
  assert.match(defs["public.staff_review_content_report"].body, /Recusal required: you are a party to this report/);
  assert.match(defs["public.staff_set_content_hold"].body, /Recusal required: you own this content/);
  assert.match(defs["public.staff_set_content_hold"].body, /Recusal required: you reported this content/);
  assert.doesNotMatch(defs["public.staff_review_content_report"].body, /delete from|publication_state|unpublish/i);
});

test("the 081 draft fails closed until the definer read RPCs adopt the hold filter", async () => {
  const draft = await read(draftPath);
  const marker = draft.indexOf("@@ADOPTION-EDITS-GO-HERE@@");
  const guard = draft.indexOf("raise exception 'Moderation holds not adopted");
  assert.ok(marker > 0 && guard > marker);
  assert.ok(draft.indexOf("Unreviewed read policy") < draft.indexOf("alter policy"));
  assert.doesNotMatch(draft, /drop policy/);
  for (const name of [
    "my_persona_mode_feed", "my_persona_mode_profile_posts", "my_persona_mode_post_panel",
    "add_persona_comment", "persona_mode_add_comment", "toggle_persona_reaction", "persona_mode_toggle_reaction",
  ]) {
    assert.match(draft.slice(marker, guard), new RegExp(`'${name}'`), `${name} guarded`);
  }
});

test("disposable SQL runtime suite is wired up", async () => {
  const [seed, runtime, holds, sh, ps1] = await Promise.all([
    read("tests/sql/content-reports-seed.sql"), read("tests/sql/content-reports-runtime.sql"),
    read("tests/sql/content-holds-runtime.sql"),
    read("scripts/test-content-reports-sql.sh"), read("scripts/test-content-reports-sql.ps1"),
  ]);
  assert.match(seed, /create or replace function public\.persona_visible/);
  assert.match(seed, /alter database postgres set role = 'db_owner'/, "runs as a non-superuser owner");
  assert.match(runtime, /content reports runtime: passed/);
  assert.match(runtime, /dblink_is_busy/);
  assert.match(holds, /content holds runtime: passed/);
  assert.match(sh, /content-reports-seed\.sql/);
  assert.equal((sh.match(/apply "\$repo\/\$migration"/g) || []).length, 2, "migration applied twice");
  assert.equal((sh.match(/^refuse "/gm) || []).length, 5, "five refusals of the 081 draft");
  assert.match(ps1, /postgres:16/);
  assert.match(ps1, /test-content-reports-sql\.sh/);
});
