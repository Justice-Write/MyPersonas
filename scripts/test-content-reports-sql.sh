#!/usr/bin/env bash
# Disposable PostgreSQL 16 run without Docker:
#   seed -> 080 -> 080 again (idempotency) -> reports runtime (with dblink races)
#   -> the 081 holds draft must refuse five ways and roll back
#   -> 081 with the adoption stubs -> holds runtime.
# Needs PostgreSQL 16 server binaries (PG_BIN, default /usr/lib/postgresql/16/bin)
# and psql, run as a non-root user (initdb refuses root). On Windows use
# scripts/test-content-reports-sql.ps1, which runs this script in postgres:16.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
data="$(mktemp -d)"; port="${PG_TEST_PORT:-55433}"; sock="$(mktemp -d)"; work="$(mktemp -d)"
"$bin/initdb" -D "$data" -A trust -U postgres >/dev/null
"$bin/pg_ctl" -D "$data" -o "-p $port -k $sock" -l "$data/log" -w start >/dev/null
trap '"$bin/pg_ctl" -D "$data" stop -m immediate >/dev/null 2>&1; rm -rf "$data" "$sock" "$work"' EXIT

migration=supabase/migrations/20261016180000_content_reports_moderation_queue.sql
holds=MyPersonas.Online_v0/sql-updates/081-content-moderation-holds.DRAFT.sql

sql() { psql -h "$sock" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t "$@"; }
apply() {
  local file="$1" out
  echo "== ${file#"$repo"/}"
  if ! out=$(sql -f "$file" 2>&1); then
    echo "$out" | grep -E "ERROR|CONTEXT" | head -5; echo "FAILED at ${file#"$repo"/}"; exit 1
  fi
  echo "$out" | grep "passed" || true
}
refuse() {
  local label="$1" pattern="$2" file="$3" out
  if out=$(sql -f "$file" 2>&1); then echo "FAILED: 081 applied despite: $label"; exit 1; fi
  if ! grep -q "$pattern" <<<"$out"; then
    echo "$out" | grep -E "ERROR" | head -3; echo "FAILED: 081 refused for an unexpected reason: $label"; exit 1
  fi
  if [ "$(sql -A -c "select coalesce(to_regclass('public.content_moderation_holds')::text, 'none')")" != "none" ]; then
    echo "FAILED: refused 081 left objects behind: $label"; exit 1
  fi
  echo "081 refused and rolled back: $label"
}

apply "$repo/tests/sql/content-reports-seed.sql"
apply "$repo/$migration"
apply "$repo/$migration"
test "$(sql -A -c "select pg_get_userbyid(relowner) from pg_class where oid = 'public.content_reports'::regclass")" = "db_owner"
# The owner's post-apply snippet must report ok on a correct install.
verify="$(sql -A -F '|' -f "$repo/supabase/snippets/verify_080_content_reports.sql")"
if grep -q '|f$' <<<"$verify" || [ "$(grep -c '|t$' <<<"$verify")" -ne 9 ]; then
  echo "$verify"; echo "FAILED: verify_080_content_reports.sql"; exit 1
fi
echo "verify_080_content_reports.sql: 9/9 ok"
apply "$repo/tests/sql/content-reports-runtime.sql"

adopted="$work/081-adopted.sql"
sed "/@@ADOPTION-EDITS-GO-HERE@@/r $repo/tests/sql/content-holds-adoption.sql" "$repo/$holds" >"$adopted"
refuse "no adoption edits" "must filter moderation_private.content_held" "$repo/$holds"
sed "s/^  if moderation_private.content_held(.post., p_post_id) then raise exception .Post not found.; end if;$/  -- moderation_private.content_held is checked elsewhere/" \
  "$adopted" >"$work/081-comment-only.sql"
refuse "filter only mentioned in a comment" "must filter moderation_private.content_held" "$work/081-comment-only.sql"
sql -c "create function public.leaky_feed() returns setof public.posts language sql stable security definer set search_path = '' as \$\$ select * from public.posts \$\$;
        grant execute on function public.leaky_feed() to authenticated;" >/dev/null
refuse "unreviewed definer function" "unreviewed SECURITY DEFINER functions read posts" "$adopted"
sql -c "drop function public.leaky_feed();" >/dev/null
sql -c "create policy \"extra read\" on public.posts for select using (true);" >/dev/null
refuse "extra read policy" "Unreviewed read policy" "$adopted"
sql -c "drop policy \"extra read\" on public.posts;" >/dev/null
sql -c "create view public.all_posts as select * from public.posts;" >/dev/null
refuse "owner-rights view" "owner-rights views" "$adopted"
sql -c "drop view public.all_posts;" >/dev/null

apply "$adopted"
apply "$repo/tests/sql/content-holds-runtime.sql"
echo "Content reports (080) and holds draft (081): all checks passed."
