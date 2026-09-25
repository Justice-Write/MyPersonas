import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const updatePath = path.join(
  repoRoot,
  "MyPersonas.Online_v0/sql-updates/062-persona-media-unchanged-url-compatibility.sql",
);
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260828073414_persona_media_unchanged_url_compatibility.sql",
);
const [sql, migration] = await Promise.all([
  readFile(updatePath, "utf8"),
  readFile(migrationPath, "utf8"),
]);

const slots = [
  ["avatar_url", "avatar_media_asset_id"],
  ["banner_url", "banner_media_asset_id"],
  ["bg_url", "bg_media_asset_id"],
  ["feed_img_url", "feed_media_asset_id"],
];

test("SQL update 062 and its Supabase migration mirror are identical and transactional", () => {
  assert.equal(sql, migration);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /create or replace function public\.bind_persona_media_asset_references\(\)/);
  assert.match(sql, /security definer set search_path=''/);
  assert.match(sql, /revoke all on function public\.bind_persona_media_asset_references\(\)\s+from public,anon,authenticated;/);
});

test("INSERTs still resolve every persona media URL through the strict registry", () => {
  const start = sql.indexOf("if tg_op='INSERT' then");
  const end = sql.indexOf("return new;", start);
  assert.ok(start >= 0 && end > start, "the explicit INSERT branch must remain present");
  const insertBranch = sql.slice(start, end);
  for (const [urlColumn, assetColumn] of slots) {
    assert.match(
      insertBranch,
      new RegExp(
        `new\\.${assetColumn}:=public\\.resolve_persona_media_asset_reference\\(new\\.id,new\\.${urlColumn}\\);`,
      ),
    );
  }
});

test("UPDATEs preserve bindings only for unchanged URLs and resolve every changed URL", () => {
  for (const [urlColumn, assetColumn] of slots) {
    assert.match(
      sql,
      new RegExp(
        `if new\\.${urlColumn} is not distinct from old\\.${urlColumn} then\\s+` +
          `new\\.${assetColumn}:=old\\.${assetColumn};\\s+else\\s+` +
          `new\\.${assetColumn}:=public\\.resolve_persona_media_asset_reference\\(new\\.id,new\\.${urlColumn}\\);`,
      ),
    );
  }
});
