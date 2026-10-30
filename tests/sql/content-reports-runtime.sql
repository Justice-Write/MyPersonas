-- Runtime assertions for 080-content-reports-moderation-queue.sql. Runs as db_owner
-- after the seed and two applications of the migration.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Accounts
\set N '00000000-0000-0000-0000-00000000000a'
\set S '00000000-0000-0000-0000-00000000000b'
\set W '00000000-0000-0000-0000-00000000000c'
\set E '00000000-0000-0000-0000-00000000000d'
\set T '00000000-0000-0000-0000-00000000000e'
\set U '00000000-0000-0000-0000-00000000000f'
\set V '00000000-0000-0000-0000-000000000010'
\set F '00000000-0000-0000-0000-000000000011'
\set R '00000000-0000-0000-0000-000000000012'
\set Q '00000000-0000-0000-0000-000000000013'
\set Z '00000000-0000-0000-0000-000000000014'
\set RL '00000000-0000-0000-0000-000000000015'
\set DL '00000000-0000-0000-0000-000000000016'
-- Personas
\set pn '10000000-0000-0000-0000-00000000000a'
\set ps '10000000-0000-0000-0000-00000000000b'
\set pw '10000000-0000-0000-0000-00000000000c'
\set pe '10000000-0000-0000-0000-00000000000d'
\set pd '10000000-0000-0000-0000-00000000001d'
\set pv '10000000-0000-0000-0000-000000000010'
\set pp '10000000-0000-0000-0000-000000000011'
\set pz '10000000-0000-0000-0000-000000000014'
-- Posts and comments
\set post_n '20000000-0000-0000-0000-00000000000a'
\set post_s '20000000-0000-0000-0000-00000000000b'
\set post_s2 '20000000-0000-0000-0000-00000000001b'
\set post_w '20000000-0000-0000-0000-00000000000c'
\set post_w2 '20000000-0000-0000-0000-00000000001c'
\set post_d '20000000-0000-0000-0000-00000000000d'
\set post_v '20000000-0000-0000-0000-000000000010'
\set post_p '20000000-0000-0000-0000-000000000011'
\set post_z '20000000-0000-0000-0000-000000000014'
\set c_s_on_n '30000000-0000-0000-0000-00000000000b'
\set c_w_on_w2 '30000000-0000-0000-0000-00000000001c'
\set c_n_on_w2 '30000000-0000-0000-0000-00000000002c'

insert into public.profiles(id, email) values
  (:'N', 'north@example.invalid'), (:'S', 'south@example.invalid'), (:'W', 'west@example.invalid'),
  (:'E', 'east@example.invalid'), (:'T', 'tech@example.invalid'), (:'U', 'admin@example.invalid'),
  (:'V', 'staff-owner@example.invalid'), (:'F', 'friend@example.invalid'), (:'R', 'racer@example.invalid'),
  (:'Q', 'reopen@example.invalid'), (:'Z', 'dependent@example.invalid'),
  (:'RL', 'hourly@example.invalid'), (:'DL', 'daily@example.invalid');
insert into public.personas(id, owner, handle, name, tagline, visibility, publication_state) values
  (:'pn', :'N', 'north', 'North', 'north tagline', 'public', 'published'),
  (:'ps', :'S', 'south', 'South', 'south tagline', 'public', 'published'),
  (:'pw', :'W', 'west', 'West', 'west tagline', 'public', 'published'),
  (:'pe', :'E', 'east', 'East', 'east tagline', 'public', 'published'),
  (:'pd', :'E', 'east_draft', 'East Draft', '', 'public', 'draft'),
  (:'pv', :'V', 'staffer', 'Staffer', '', 'public', 'published'),
  (:'pp', :'F', 'private_friend', 'Private Friend', '', 'private', 'published'),
  (:'pz', :'Z', 'dependent', 'Dependent', '', 'public', 'published');
insert into public.follows(follower, target, status) values (:'pe', :'pp', 'accepted');
-- pz's published page depends on South's persona.
insert into public.persona_publication_dependencies(persona_id, owner, dependency_persona_id)
values (:'pz', :'Z', :'ps');
insert into public.posts(id, persona_id, kind, title, body) values
  (:'post_n', :'pn', 'update', '', 'north post'),
  (:'post_s', :'ps', 'update', 'Loud', 'south post with insults'),
  (:'post_s2', :'ps', 'update', '', 'second south post'),
  (:'post_w', :'pw', 'update', '', 'west post'),
  (:'post_w2', :'pw', 'update', '', 'second west post'),
  (:'post_d', :'pd', 'update', '', 'unpublished draft post'),
  (:'post_v', :'pv', 'update', '', 'staff member own post'),
  (:'post_p', :'pp', 'update', '', 'friends-only post'),
  (:'post_z', :'pz', 'update', '', 'dependent post');
insert into public.comments(id, post_id, persona_id, body) values
  (:'c_s_on_n', :'post_n', :'ps', 'south comment on north'),
  (:'c_w_on_w2', :'post_w2', :'pw', 'west comment on own post'),
  (:'c_n_on_w2', :'post_w2', :'pn', 'north comment on west');
insert into public.reactions(post_id, persona_id, kind) values (:'post_w2', :'pn', 'like');
insert into public.platform_role_assignments(account_id, role_key) values
  (:'T', 'technician'), (:'U', 'global_administrator'), (:'V', 'technician');

-- 1. No direct access for any Data API role, and no access to moderation_private.
set role anon;
select test_expect_error('select count(*) from public.content_reports', 'permission denied');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_s'), 'permission denied');
reset role;
select test_assert(current_user = 'db_owner', 'reset role returns to the non-superuser owner');
select test_as(:'N');
set role authenticated;
select test_expect_error('select count(*) from public.content_reports', 'permission denied');
select test_expect_error('select count(*) from public.content_report_events', 'permission denied');
select test_expect_error(format($f$insert into public.content_reports(reporter, target_kind, target_id, target_persona_id, target_post_id, reason) values (%L, 'post', %L, %L, %L, 'spam')$f$, :'N', :'post_s', :'ps', :'post_s'), 'permission denied');
select test_expect_error(format($f$select moderation_private.report_persona_reachable(%L)$f$, :'ps'), 'permission denied');
select test_expect_error(format($f$select moderation_private.persona_viewable_ignoring_own_rule(%L)$f$, :'ps'), 'permission denied');
reset role;

-- 2. Unsigned authenticated role fails closed.
select test_as(null);
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_s'), 'Authentication required');
select test_expect_error('select * from public.my_content_reports()', 'Authentication required');
reset role;

-- 3. Input validation.
select test_as(:'N');
set role authenticated;
select test_expect_error(format($f$select public.report_content('album', %L, 'spam')$f$, :'post_s'), 'Invalid report target');
select test_expect_error(format($f$select public.report_content('post', %L, 'rude')$f$, :'post_s'), 'Invalid report reason');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam', repeat('x', 2001))$f$, :'post_s'), 'too long');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam', '', %L)$f$, :'post_s', :'ps'), 'Acting persona must be yours');

-- 4. Not-found paths are one message: missing, unpublished.
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, gen_random_uuid()), 'Reported content was not found');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_d'), 'Reported content was not found');
select test_expect_error(format($f$select public.report_content('persona', %L, 'spam')$f$, :'pd'), 'Reported content was not found');

-- 5. Self-report is refused.
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_n'), 'cannot report your own');

-- 6. A visible post, a comment, and a persona can be reported.
select public.report_content('post', :'post_s', 'harassment', '  repeated insults  ', :'pn') as r1 \gset
select test_assert((:'r1'::jsonb ->> 'duplicate')::boolean = false, 'first report is not a duplicate');
select test_assert(:'r1'::jsonb ->> 'state' = 'open', 'first report is open');
select test_assert(not (:'r1'::jsonb ? 'target_owner'), 'reporter output omits target_owner');
select public.report_content('post', :'post_s', 'spam') as r1dup \gset
select test_assert((:'r1dup'::jsonb ->> 'duplicate')::boolean, 'repeat report is a duplicate');
select test_assert(:'r1dup'::jsonb ->> 'id' = :'r1'::jsonb ->> 'id', 'duplicate returns the same report');
select public.report_content('comment', :'c_s_on_n', 'harassment') as rc \gset
select public.report_content('persona', :'ps', 'impersonation') as rp \gset
select test_assert(:'rc'::jsonb ->> 'state' = 'open' and :'rp'::jsonb ->> 'state' = 'open', 'comment and persona reports open');

-- 7. Reporter-safe projection.
select test_assert((select count(*) = 3 from public.my_content_reports()), 'north sees three own reports');
select test_assert((
  select bool_and(not (to_jsonb(mine) ? 'target_owner') and not (to_jsonb(mine) ? 'details') and not (to_jsonb(mine) ? 'assigned_to'))
  from public.my_content_reports() mine
), 'my reports omit target_owner, details and assignment');
reset role;

-- 8. The reported party has no read path.
select test_as(:'S');
set role authenticated;
select test_assert((select count(*) = 0 from public.my_content_reports()), 'south sees no reports about south');
select test_expect_error('select * from public.staff_list_content_reports()', 'Staff role required');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'resolved', 'no_violation')$f$, :'r1'::jsonb ->> 'id'), 'Staff role required');
reset role;

-- 9. Block semantics never reveal the other side's block.
-- 9a. South blocks North: North gets not-found for South's other post.
insert into public.blocks(blocker, blocked_persona, kind) values (:'S', :'pn', 'block');
select test_as(:'N');
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_s2'), 'Reported content was not found');
reset role;
-- 9b. North mutes South: still not found. A rule of your own never opens a
-- path the other side's block closed.
insert into public.blocks(blocker, blocked_persona, kind) values (:'N', :'ps', 'mute');
select test_as(:'N');
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_s2'), 'Reported content was not found');
select test_expect_error(format($f$select public.report_content('persona', %L, 'spam')$f$, :'ps'), 'Reported content was not found');
reset role;
delete from public.blocks where blocker = :'N' and blocked_persona = :'ps';
-- 9c. North blocks West: North can still report West (block-then-report).
insert into public.blocks(blocker, blocked_persona, kind) values (:'N', :'pw', 'block');
select test_as(:'N');
set role authenticated;
select public.report_content('post', :'post_w', 'spam') as rw \gset
select test_assert(:'rw'::jsonb ->> 'state' = 'open', 'block-then-report works');
reset role;
-- 9d. Private persona: a friend who muted it can report; a stranger cannot.
insert into public.blocks(blocker, blocked_persona, kind) values (:'E', :'pp', 'mute'), (:'N', :'pp', 'block');
select test_as(:'E');
set role authenticated;
select public.report_content('post', :'post_p', 'privacy') as rpriv \gset
select test_assert(:'rpriv'::jsonb ->> 'state' = 'open', 'muted private friend can be reported');
reset role;
select test_as(:'N');
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_p'), 'Reported content was not found');
reset role;
-- 9e. Publication dependencies: pz depends on South, who blocked North.
-- 9f. Blocking an unpublished persona does not make it reportable.
insert into public.blocks(blocker, blocked_persona, kind) values (:'N', :'pz', 'mute'), (:'N', :'pd', 'block');
select test_as(:'N');
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_z'), 'Reported content was not found');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_d'), 'Reported content was not found');
reset role;
-- Blocking any persona blocks its account, so lift the draft block before
-- East is used as an unblocked viewer.
delete from public.blocks where blocker = :'N' and blocked_persona = :'pd';
select test_as(:'E');
set role authenticated;
select test_assert((public.report_content('post', :'post_z', 'spam')) ->> 'state' = 'open', 'dependent post reportable when nothing blocks');
reset role;

-- 10. Staff queue needs role and AAL2, and shows staff the target owner.
select test_as(:'T', 'aal1');
set role authenticated;
select test_expect_error('select * from public.staff_list_content_reports()', 'Two-factor verification required');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review')$f$, :'r1'::jsonb ->> 'id'), 'Two-factor verification required');
reset role;
select test_as(:'T', 'aal2');
set role authenticated;
select test_assert((
  select target_owner = :'S'::uuid and target_handle = 'south' and target_still_exists
     and target_excerpt like 'Loud%' and details = 'repeated insults' and reporter = :'N'::uuid
     and reporter_persona_id = :'pn'::uuid and unresolved_reports_on_target = 1
  from public.staff_list_content_reports(null, 200) where id = (:'r1'::jsonb ->> 'id')::uuid
), 'queue row carries staff fields');
select test_expect_error('select * from public.staff_list_content_reports(''closed'')', 'Invalid report state');
reset role;

-- 11. Recusal for target owners and reporters.
select test_as(:'N');
set role authenticated;
select public.report_content('post', :'post_v', 'spam') as rv \gset
reset role;
select test_as(:'V', 'aal2');
set role authenticated;
select test_assert((select count(*) = 0 from public.staff_list_content_reports(null, 200) where id = (:'rv'::jsonb ->> 'id')::uuid), 'staff owner does not see report about own post');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'resolved', 'no_violation')$f$, :'rv'::jsonb ->> 'id'), 'Recusal required');
reset role;
select test_as(:'U', 'aal2');
set role authenticated;
select public.report_content('post', :'post_s', 'spam') as ru \gset
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review')$f$, :'ru'::jsonb ->> 'id'), 'Recusal required');
reset role;

-- 12. Transitions, assignment semantics and the event trail.
select test_as(:'T', 'aal2');
set role authenticated;
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'resolved')$f$, :'r1'::jsonb ->> 'id'), 'resolution is required');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'open', 'no_violation')$f$, :'r1'::jsonb ->> 'id'), 'Only resolved reports');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review', '', %L)$f$, :'r1'::jsonb ->> 'id', :'E'), 'Assignee must be an active');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review', '', %L)$f$, :'rv'::jsonb ->> 'id', :'V'), '^Assignee is a party');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review', '', %L, '', true)$f$, :'r1'::jsonb ->> 'id', :'U'), 'not both');
select test_assert((public.staff_review_content_report((:'r1'::jsonb ->> 'id')::uuid, 'needs_review', '', :'U'::uuid, 'escalating')) ->> 'event' = 'triaged', 'open to needs_review is triaged');
select test_assert((public.staff_review_content_report((:'r1'::jsonb ->> 'id')::uuid, 'needs_review', '', null, 'just a note')) ->> 'assigned_to' = :'U', 'a note keeps the assignee');
select test_assert((public.staff_review_content_report((:'r1'::jsonb ->> 'id')::uuid, 'needs_review', '', null, '', true)) ->> 'event' = 'assigned', 'unassign is logged as assigned');
select test_assert((public.staff_review_content_report((:'r1'::jsonb ->> 'id')::uuid, 'resolved', 'action_taken', null, 'removed')) ->> 'event' = 'resolved', 'resolve is resolved');
select resolved_at as r1_resolved_at from public.staff_list_content_reports('resolved', 200) where id = (:'r1'::jsonb ->> 'id')::uuid \gset
select pg_sleep(0.05);
select test_assert((public.staff_review_content_report((:'r1'::jsonb ->> 'id')::uuid, 'resolved', 'no_violation')) ->> 'event' = 'resolution_changed', 'resolution change is its own event');
select test_assert((select resolved_at = :'r1_resolved_at'::timestamptz and resolution = 'no_violation' from public.staff_list_content_reports('resolved', 200) where id = (:'r1'::jsonb ->> 'id')::uuid), 'resolution change keeps resolved_at');
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'open')$f$, :'r1'::jsonb ->> 'id'), 'Reopen a resolved report');
select test_assert((public.staff_review_content_report((:'rw'::jsonb ->> 'id')::uuid, 'resolved', 'no_violation')) ->> 'state' = 'resolved', 'west report resolved');
reset role;
select test_as(:'N');
set role authenticated;
select public.report_content('post', :'post_w', 'privacy') as rw2 \gset
select test_assert((:'rw2'::jsonb ->> 'duplicate')::boolean = false and :'rw2'::jsonb ->> 'id' <> :'rw'::jsonb ->> 'id', 'new report after resolution');
select test_assert((select state = 'resolved' from public.my_content_reports() where id = (:'r1'::jsonb ->> 'id')::uuid), 'reporter sees resolved');
reset role;
select test_as(:'T', 'aal2');
set role authenticated;
select test_expect_error(format($f$select public.staff_review_content_report(%L, 'needs_review')$f$, :'rw'::jsonb ->> 'id'), 'newer unresolved report');
reset role;

select test_assert((
  select array_agg(event_type order by created_at, event_type) = array['created','triaged','commented','assigned','resolved','resolution_changed']
  from public.content_report_events where report_id = (:'r1'::jsonb ->> 'id')::uuid
), 'r1 event trail');
select test_assert((
  select to_assignee = :'U'::uuid and from_assignee is null
  from public.content_report_events where report_id = (:'r1'::jsonb ->> 'id')::uuid and event_type = 'triaged'
), 'trail records the new assignee');
select test_assert((
  select from_resolution = 'action_taken' and to_resolution = 'no_violation'
  from public.content_report_events where report_id = (:'r1'::jsonb ->> 'id')::uuid and event_type = 'resolution_changed'
), 'trail records the resolution change');

-- 13. Paging on (created_at, id) does not skip rows that share a timestamp.
update public.content_reports set created_at = '2026-01-01T00:00:00Z'
where id in ((:'rc'::jsonb ->> 'id')::uuid, (:'rp'::jsonb ->> 'id')::uuid);
select test_as(:'T', 'aal2');
set role authenticated;
select created_at as page1_at, id as page1_id from public.staff_list_content_reports(null, 1) \gset
select id as page2_id from public.staff_list_content_reports(null, 1, :'page1_at'::timestamptz, :'page1_id'::uuid) \gset
select test_assert(
  array[:'page1_id', :'page2_id']::uuid[] @> array[(:'rc'::jsonb ->> 'id')::uuid, (:'rp'::jsonb ->> 'id')::uuid]
  and :'page1_id' <> :'page2_id', 'two pages return both tied reports');
reset role;

-- 14. Hourly limit: 20 per reporter.
insert into public.posts(persona_id, body) select :'pw', 'bulk ' || g from generate_series(1, 21) g;
select test_as(:'RL');
set role authenticated;
do $$
declare v_post uuid; v_count integer := 0;
begin
  for v_post in select id from public.posts where body like 'bulk %' order by body loop
    exit when v_count = 20;
    perform public.report_content('post', v_post, 'spam');
    v_count := v_count + 1;
  end loop;
end;
$$;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_w2'), 'Report limit reached');
reset role;

-- 15. Daily limit: 100 per reporter, counted across the last day.
insert into public.content_reports(reporter, target_kind, target_id, target_persona_id, target_post_id, reason, created_at)
select :'DL', 'post', ids.g, :'pw', ids.g, 'spam', now() - interval '2 hours'
from (select gen_random_uuid() as g from generate_series(1, 100)) ids;
select test_as(:'DL');
set role authenticated;
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_w2'), 'Report limit reached');
reset role;

-- 16. Concurrency, with dblink sessions. Each check proves the second session
-- really waited (dblink_is_busy) before the first one committed.
insert into public.profiles(id, email) values ('00000000-0000-0000-0000-000000000017', 'limit-race@example.invalid');
insert into public.posts(persona_id, body) values (:'pw', 'race target'), (:'pw', 'reopen race target'),
  (:'pw', 'limit race a'), (:'pw', 'limit race b');
insert into public.content_reports(reporter, target_kind, target_id, target_persona_id, target_post_id, reason)
select '00000000-0000-0000-0000-000000000017', 'post', ids.g, :'pw', ids.g, 'spam'
from (select gen_random_uuid() as g from generate_series(1, 19)) ids;
select id as race_target from public.posts where body = 'race target' \gset
select id as reopen_target from public.posts where body = 'reopen race target' \gset
select id as limit_a from public.posts where body = 'limit race a' \gset
select id as limit_b from public.posts where body = 'limit race b' \gset
select test_as(:'Q');
set role authenticated;
select public.report_content('post', :'reopen_target', 'privacy') ->> 'id' as rq \gset
reset role;
select test_as(:'T', 'aal2');
set role authenticated;
select public.staff_review_content_report(:'rq'::uuid, 'resolved', 'no_violation');
reset role;

set role postgres;
select format('host=%s port=%s dbname=%s user=postgres',
  split_part(current_setting('unix_socket_directories'), ',', 1),
  current_setting('port'), current_database()) as conn \gset
create or replace function pg_temp.session_as(p_conn text, p_uid uuid, p_aal text) returns void
language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'set role authenticated');
  perform dblink_exec(p_conn, format('set request.jwt.claims = %L',
    json_build_object('sub', p_uid, 'aal', p_aal, 'role', 'authenticated')::text));
end;
$$;
select dblink_connect('race_a', :'conn'), dblink_connect('race_b', :'conn');

-- 16a. Two sessions report the same target: one row, one duplicate.
select pg_temp.session_as('race_a', :'R', 'aal1'), pg_temp.session_as('race_b', :'R', 'aal1');
select dblink_exec('race_a', 'begin');
select * from dblink('race_a', format('select public.report_content(%L, %L, %L)::text', 'post', :'race_target', 'spam')) as t(result text);
select dblink_send_query('race_b', format('select public.report_content(%L, %L, %L)::text', 'post', :'race_target', 'spam'));
select pg_sleep(0.5);
select test_assert(dblink_is_busy('race_b') = 1, 'second reporter waits for the first');
select dblink_exec('race_a', 'commit');
select result as race_b from dblink_get_result('race_b') as t(result text) \gset
select * from dblink_get_result('race_b') as t(result text);
select test_assert((:'race_b'::jsonb ->> 'duplicate')::boolean, 'concurrent repeat report is a duplicate');
select test_assert((select count(*) = 1 from public.content_reports where target_id = :'race_target'), 'concurrent reports collapse to one row');

-- 16b. Staff reopen an old report while the reporter files a new one: the
-- reporter's insert waits on the unique index, then gets the reopened report.
select pg_temp.session_as('race_a', :'T', 'aal2'), pg_temp.session_as('race_b', :'Q', 'aal1');
select dblink_exec('race_a', 'begin');
select * from dblink('race_a', format('select public.staff_review_content_report(%L, %L)::text', :'rq', 'needs_review')) as t(result text);
select dblink_send_query('race_b', format('select public.report_content(%L, %L, %L)::text', 'post', :'reopen_target', 'spam'));
select pg_sleep(0.5);
select test_assert(dblink_is_busy('race_b') = 1, 'reporter insert waits for the reopen');
select dblink_exec('race_a', 'commit');
select result as reopen_b from dblink_get_result('race_b') as t(result text) \gset
select * from dblink_get_result('race_b') as t(result text);
select test_assert((:'reopen_b'::jsonb ->> 'duplicate')::boolean and :'reopen_b'::jsonb ->> 'id' = :'rq', 'reporter receives the reopened report as a duplicate');

-- 16c. A burst cannot pass the hourly limit: 19 exist, two arrive together.
select pg_temp.session_as('race_a', '00000000-0000-0000-0000-000000000017', 'aal1'),
       pg_temp.session_as('race_b', '00000000-0000-0000-0000-000000000017', 'aal1');
select dblink_exec('race_a', 'begin');
select * from dblink('race_a', format('select public.report_content(%L, %L, %L)::text', 'post', :'limit_a', 'spam')) as t(result text);
select dblink_send_query('race_b', format('select public.report_content(%L, %L, %L)::text', 'post', :'limit_b', 'spam'));
select pg_sleep(0.5);
select test_assert(dblink_is_busy('race_b') = 1, 'second burst report waits for the first');
select dblink_exec('race_a', 'commit');
select count(*) from dblink_get_result('race_b', false) as t(result text);
select test_assert(dblink_error_message('race_b') like '%Report limit reached%', 'burst stops at the hourly limit');
select test_assert((select count(*) = 20 from public.content_reports where reporter = '00000000-0000-0000-0000-000000000017'), 'exactly 20 reports in the hour');
select dblink_disconnect('race_a'), dblink_disconnect('race_b');
reset role;

\echo 'content reports runtime: passed'
