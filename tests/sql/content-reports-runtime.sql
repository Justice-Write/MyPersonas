-- Runtime assertions for 20261016180000_content_reports_moderation_queue.sql (run after seed + migration twice).
\set ON_ERROR_STOP 1
create function pg_temp.expect_error(p_sql text, p_fragment text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error containing "%" but statement succeeded: %', p_fragment, p_sql;
exception when others then
  if sqlerrm like 'expected error containing%' then raise; end if;
  if position(lower(p_fragment) in lower(sqlerrm)) = 0 then
    raise exception 'expected "%", got "%" for: %', p_fragment, sqlerrm, p_sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text,text) to public;

-- ===== Reporter A (AAL1 is enough to report) =====
set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',false);
select set_config('request.jwt.claim.aal','aal1',false);
do $$
declare r1 uuid; r2 uuid; n int;
begin
  r1 := public.report_content('persona','b1000000-0000-4000-8000-0000000000b1','harassment','  repeated slurs  ');
  r2 := public.report_content('persona','b1000000-0000-4000-8000-0000000000b1','spam','');
  if r1 is null or r1 <> r2 then raise exception 'duplicate active report was not deduplicated'; end if;
  perform public.report_content('post','b1a00000-0000-4000-8000-00000000b1a0','spam','', 'a1000000-0000-4000-8000-0000000000a1');
  -- someone else's comment on A's own post is reportable
  perform public.report_content('comment','cc100000-0000-4000-8000-0000000cc100','harassment');
end $$;
select pg_temp.expect_error($q$select public.report_content('persona','a1000000-0000-4000-8000-0000000000a1','spam')$q$, 'cannot report your own');
select pg_temp.expect_error($q$select public.report_content('persona','b2000000-0000-4000-8000-0000000000b2','spam')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('post','b2a00000-0000-4000-8000-00000000b2a0','spam')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('comment','cc200000-0000-4000-8000-0000000cc200','spam')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('persona','b3000000-0000-4000-8000-0000000000b3','spam')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('post','00000000-0000-4000-8000-000000000000','spam')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('persona','b1000000-0000-4000-8000-0000000000b1','rude')$q$, 'Invalid report reason');
select pg_temp.expect_error($q$select public.report_content('album','b1000000-0000-4000-8000-0000000000b1','spam')$q$, 'Invalid report target');
select pg_temp.expect_error(format('select public.report_content(%L,%L,%L,%L)','persona','c1000000-0000-4000-8000-0000000000c1','other',repeat('x',401)), 'too long');
select pg_temp.expect_error($q$select public.report_content('persona','c1000000-0000-4000-8000-0000000000c1','spam','','b1000000-0000-4000-8000-0000000000b1')$q$, 'must be your own');
-- No direct table access, read or write
select pg_temp.expect_error($q$select count(*) from public.content_reports$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.content_reports(reporter,target_kind,target_id,target_persona_id,reason) values (auth.uid(),'persona',gen_random_uuid(),'b1000000-0000-4000-8000-0000000000b1','spam')$q$, 'permission denied');
select pg_temp.expect_error($q$select count(*) from public.content_report_events$q$, 'permission denied');
-- Staff RPCs refuse a non-staff account even at AAL2
select set_config('request.jwt.claim.aal','aal2',false);
select pg_temp.expect_error($q$select * from public.staff_list_content_reports('open')$q$, 'Staff role required');
select pg_temp.expect_error($q$select public.staff_resolve_content_report(gen_random_uuid(),'dismissed')$q$, 'Staff role required');
reset role;

-- ===== Blocks are symmetric for reporting (A blocks bravo; charlie's owner blocks alpha) =====
insert into public.blocks(blocker,blocked_persona,kind) values
 ('a0000000-0000-4000-8000-00000000000a','b1000000-0000-4000-8000-0000000000b1','block'),
 ('c0000000-0000-4000-8000-00000000000c','a1000000-0000-4000-8000-0000000000a1','block');
set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',false);
select pg_temp.expect_error($q$select public.report_content('post','b1a00000-0000-4000-8000-00000000b1a0','harassment','again')$q$, 'Reportable content not found');
select pg_temp.expect_error($q$select public.report_content('persona','c1000000-0000-4000-8000-0000000000c1','spam')$q$, 'Reportable content not found');
reset role;

-- ===== Anonymous cannot call any of it =====
set role anon;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.expect_error($q$select public.report_content('persona','b1000000-0000-4000-8000-0000000000b1','spam')$q$, 'permission denied');
select pg_temp.expect_error($q$select * from public.staff_list_content_reports('open')$q$, 'permission denied');
reset role;

-- ===== Rate limit: 20 per account per hour =====
insert into public.content_reports(reporter,target_kind,target_id,target_persona_id,reason,status,resolved_at)
select 'c0000000-0000-4000-8000-00000000000c','post',gen_random_uuid(),'b1000000-0000-4000-8000-0000000000b1','spam','dismissed',now()
from generate_series(1,20);
set role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',false);
select pg_temp.expect_error($q$select public.report_content('persona','b1000000-0000-4000-8000-0000000000b1','spam')$q$, 'Report limit reached');
reset role;

-- ===== Staff: expired role, AAL1, then a working AAL2 technician =====
set role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-00000000000e',false);
select set_config('request.jwt.claim.aal','aal2',false);
select pg_temp.expect_error($q$select * from public.staff_list_content_reports('open')$q$, 'Staff role required');
select set_config('request.jwt.claim.sub','5ff00000-0000-4000-8000-000000000005',false);
select set_config('request.jwt.claim.aal','aal1',false);
select pg_temp.expect_error($q$select * from public.staff_list_content_reports('open')$q$, 'Two-factor verification required');
select set_config('request.jwt.claim.aal','aal2',false);
do $$
declare v_count int; v_id uuid; v_handle text; v_details text;
begin
  select count(*) into v_count from public.staff_list_content_reports('open');
  if v_count <> 3 then raise exception 'expected 3 open reports, got %', v_count; end if;
  select id, target_handle, details into v_id, v_handle, v_details
  from public.staff_list_content_reports('open') where target_kind='persona';
  if v_handle <> 'bravo' then raise exception 'target handle not resolved: %', v_handle; end if;
  if v_details <> 'repeated slurs' then raise exception 'details not trimmed: "%"', v_details; end if;
  perform public.staff_resolve_content_report(v_id,'triaged','looking');
  perform public.staff_resolve_content_report(v_id,'actioned','owner warned');
  perform pg_temp.expect_error(format('select public.staff_resolve_content_report(%L,%L)', v_id, 'dismissed'), 'already resolved');
  perform pg_temp.expect_error(format('select public.staff_resolve_content_report(%L,%L)', v_id, 'open'), 'Invalid staff status');
  perform pg_temp.expect_error(format('select public.staff_resolve_content_report(%L,%L,%L,%L)', v_id, 'triaged', '', 'a0000000-0000-4000-8000-00000000000a'), 'Assignee must be');
  select count(*) into v_count from public.staff_list_content_reports('actioned');
  if v_count <> 1 then raise exception 'actioned report missing'; end if;
end $$;
reset role;
do $$
declare v_events int; v_resolved timestamptz;
begin
  select count(*) into v_events from public.content_report_events;
  if v_events <> 2 then raise exception 'expected 2 audit events, got %', v_events; end if;
  select resolved_at into v_resolved from public.content_reports where status='actioned';
  if v_resolved is null then raise exception 'actioned report has no resolved_at'; end if;
  -- the consistency check rejects an open report with a resolution time
  begin
    insert into public.content_reports(reporter,target_kind,target_id,target_persona_id,reason,status,resolved_at)
    values ('a0000000-0000-4000-8000-00000000000a','post',gen_random_uuid(),'b1000000-0000-4000-8000-0000000000b1','spam','open',now());
    raise exception 'inconsistent resolution accepted';
  exception when check_violation then null; end;
end $$;
select 'content reports: dedupe, own/invisible/private/draft/blocked fail closed, no table access, anon denied, rate limit, staff role + AAL2, resolve audit: passed' as result;
