#!/usr/bin/env bash
# Disposable PostgreSQL 16 run without Docker: seed -> migration -> migration (idempotency) -> runtime.
# Needs PostgreSQL 16 server binaries (PG_BIN, default /usr/lib/postgresql/16/bin) and psql.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
data="$(mktemp -d)"; port="${PG_TEST_PORT:-55433}"; sock="$(mktemp -d)"
"$bin/initdb" -D "$data" -A trust -U postgres >/dev/null
"$bin/pg_ctl" -D "$data" -o "-p $port -k $sock" -l "$data/log" start >/dev/null
trap '"$bin/pg_ctl" -D "$data" stop -m immediate >/dev/null 2>&1; rm -rf "$data" "$sock"' EXIT
for f in \
  tests/sql/content-reports-seed.sql \
  supabase/migrations/20261016180000_content_reports_moderation_queue.sql \
  supabase/migrations/20261016180000_content_reports_moderation_queue.sql \
  tests/sql/content-reports-runtime.sql; do
  echo "== $f"
  if ! out=$(psql -h "$sock" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -f "$repo/$f" 2>&1); then
    echo "$out" | grep -E "ERROR|CONTEXT" | head -5; echo "FAILED at $f"; exit 1
  fi
done
echo "$out" | grep "passed"
