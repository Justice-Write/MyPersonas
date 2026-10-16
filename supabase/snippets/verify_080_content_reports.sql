-- Read-only verification after applying 080-content-reports-moderation-queue.sql in the SQL Editor.
-- Every row should say ok = true. Nothing here writes.
select 'tables exist' as check, count(*) = 2 as ok
  from information_schema.tables where table_schema='public' and table_name in ('content_reports','content_report_events')
union all
select 'RLS on, no policies', bool_and(c.relrowsecurity) and not exists (
    select 1 from pg_policies where schemaname='public' and tablename in ('content_reports','content_report_events'))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('content_reports','content_report_events')
union all
select 'no client table grants', not exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name in ('content_reports','content_report_events')
      and grantee in ('anon','authenticated'))
union all
select 'functions are definer + empty search_path', count(*) = 3 and bool_and(p.prosecdef) and bool_and(p.proconfig @> array['search_path=""'])
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','staff_list_content_reports','staff_resolve_content_report')
union all
select 'anon cannot execute', not bool_or(has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','staff_list_content_reports','staff_resolve_content_report')
union all
select 'authenticated can execute', bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','staff_list_content_reports','staff_resolve_content_report');
