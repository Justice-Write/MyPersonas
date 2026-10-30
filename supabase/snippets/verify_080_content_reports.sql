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
select 'evidence has no cascading target keys', not exists (
    select 1 from pg_constraint con
    where con.conrelid = 'public.content_reports'::regclass and con.contype = 'f' and con.confdeltype = 'c')
union all
select 'RPCs are definer + empty search_path', count(*) = 4 and bool_and(p.prosecdef) and bool_and(p.proconfig @> array['search_path=""'])
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','my_content_reports','staff_list_content_reports','staff_review_content_report')
union all
select 'anon cannot execute the RPCs', not bool_or(has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','my_content_reports','staff_list_content_reports','staff_review_content_report')
union all
select 'authenticated can execute the RPCs', bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('report_content','my_content_reports','staff_list_content_reports','staff_review_content_report')
union all
select 'private helpers are definer and closed to Data API roles', count(*) = 4 and bool_and(p.prosecdef)
    and not bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='moderation_private'
union all
select 'moderation_private is not usable by Data API roles',
    not has_schema_privilege('anon', 'moderation_private', 'usage')
    and not has_schema_privilege('authenticated', 'moderation_private', 'usage');
