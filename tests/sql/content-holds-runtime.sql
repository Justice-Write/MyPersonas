-- Runtime assertions for 081-content-moderation-holds.DRAFT.sql. Runs as db_owner
-- after content-reports-runtime.sql in the same database and reuses its fixtures.
-- Standing rules from 01: South blocked North's persona; North blocked West's
-- and Private Friend's personas and muted Dependent; East muted Private Friend.
\set ON_ERROR_STOP 1
\set QUIET 1

\set N '00000000-0000-0000-0000-00000000000a'
\set S '00000000-0000-0000-0000-00000000000b'
\set W '00000000-0000-0000-0000-00000000000c'
\set E '00000000-0000-0000-0000-00000000000d'
\set T '00000000-0000-0000-0000-00000000000e'
\set U '00000000-0000-0000-0000-00000000000f'
\set V '00000000-0000-0000-0000-000000000010'
\set pn '10000000-0000-0000-0000-00000000000a'
\set ps '10000000-0000-0000-0000-00000000000b'
\set pw '10000000-0000-0000-0000-00000000000c'
\set pe '10000000-0000-0000-0000-00000000000d'
\set pd '10000000-0000-0000-0000-00000000001d'
\set post_n '20000000-0000-0000-0000-00000000000a'
\set post_s '20000000-0000-0000-0000-00000000000b'
\set post_w '20000000-0000-0000-0000-00000000000c'
\set post_w2 '20000000-0000-0000-0000-00000000001c'
\set post_d '20000000-0000-0000-0000-00000000000d'
\set post_v '20000000-0000-0000-0000-000000000010'
\set post_e '20000000-0000-0000-0000-00000000000e'
\set c_w_on_w2 '30000000-0000-0000-0000-00000000001c'
\set c_n_on_w2 '30000000-0000-0000-0000-00000000002c'
\set c_e_on_w2 '30000000-0000-0000-0000-00000000003c'
\set c_w_on_e '30000000-0000-0000-0000-00000000000e'
\set c_n_on_s '30000000-0000-0000-0000-00000000004b'

insert into public.posts(id, persona_id, body) values (:'post_e', :'pe', 'east post');
insert into public.comments(id, post_id, persona_id, body) values
  (:'c_w_on_e', :'post_e', :'pw', 'west comment on east'),
  (:'c_e_on_w2', :'post_w2', :'pe', 'east comment on west'),
  (:'c_n_on_s', :'post_s', :'pn', 'north comment on south');
select id as rw2 from public.content_reports
where target_kind = 'post' and target_id = :'post_w' and reason = 'privacy' \gset

-- 0. The hold predicate is not in an exposed schema.
select test_assert(not exists (
  select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like '%content_held%'
), 'no hold predicate in public, so PostgREST cannot expose it');
select test_as(null);
set role anon;
select test_expect_error(format($f$select moderation_private.content_held('post', %L)$f$, :'post_w2'), 'permission denied for schema moderation_private');
reset role;

-- 1. Before any hold, East sees West's second post, its comments, reactions.
select test_as(:'E');
set role authenticated;
select test_assert((select count(*) = 1 from public.posts where id = :'post_w2'), 'east sees post_w2');
select test_assert(public.content_visibility_state('post', :'post_w2') = 'visible', 'post_w2 visible to east');
select test_assert((select count(*) = 3 from public.comments where post_id = :'post_w2'), 'east sees three comments on post_w2');
select test_assert((select count(*) = 1 from public.reactions where post_id = :'post_w2'), 'east sees the reaction on post_w2');
select test_assert((select count(*) = 1 from public.my_persona_mode_feed(:'pe', null, null, 100) where id = :'post_w2'), 'post_w2 in east feed');
select test_assert(jsonb_array_length(public.my_persona_mode_post_panel(:'pe', :'post_e') -> 'comments') = 1, 'east panel shows the comment on east post');
select test_expect_error('select count(*) from public.content_moderation_holds', 'permission denied');
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam')$f$, :'post_w2'), 'Staff role required');
reset role;

-- 2. Staff gates: AAL2, recusal (owner, reporter linked or not), matching report.
select test_as(:'T', 'aal1');
set role authenticated;
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam')$f$, :'post_w2'), 'Two-factor verification required');
reset role;
select test_as(:'V', 'aal2');
set role authenticated;
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam')$f$, :'post_v'), 'Recusal required: you own');
reset role;
select test_as(:'U', 'aal2');
set role authenticated;
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam')$f$, :'post_s'), 'Recusal required: you reported');
reset role;
select test_as(:'T', 'aal2');
set role authenticated;
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam', %L)$f$, :'post_w2', :'rw2'), 'Report does not match');
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'rude')$f$, :'post_w2'), 'Invalid moderation reason');
select test_expect_error(format($f$select public.staff_set_content_hold('persona', %L, true, 'spam')$f$, :'pw'), 'Invalid moderation hold');
select test_expect_error(format($f$select public.staff_set_content_hold('post', %L, true, 'spam')$f$, gen_random_uuid()), 'target not found');

-- 3. Place a hold; placing it again is a no-op.
select test_assert((public.staff_set_content_hold('post', :'post_w2', true, 'harassment', null, 'first look')) ->> 'changed' = 'true', 'hold placed');
select test_assert((public.staff_set_content_hold('post', :'post_w2', true, 'harassment')) ->> 'changed' = 'false', 'second hold is a no-op');
reset role;

-- 4. Held for East: gone from table reads, feeds, panel; interactions and
-- reports refused with the same messages as missing content.
select test_as(:'E');
set role authenticated;
select test_assert((select count(*) = 0 from public.posts where id = :'post_w2'), 'east no longer reads post_w2');
select test_assert(public.content_visibility_state('post', :'post_w2') = 'unavailable', 'held post is unavailable to east');
select test_assert((select count(*) = 0 from public.comments where post_id = :'post_w2'), 'comments on a held post are hidden');
select test_assert((select count(*) = 0 from public.reactions where post_id = :'post_w2'), 'reactions on a held post are hidden');
select test_assert((select count(*) = 0 from public.my_persona_mode_feed(:'pe', null, null, 100) where id = :'post_w2'), 'held post left the feed');
select test_assert((select count(*) = 0 from public.my_persona_mode_profile_posts(:'pe', :'pw', null, null, 'all', '', 100) where id = :'post_w2'), 'held post left the profile');
select test_assert(public.my_persona_mode_post_panel(:'pe', :'post_w2') is null, 'held post panel is empty');
select test_expect_error(format($f$select public.persona_mode_add_comment(%L, %L, 'hi')$f$, :'pe', :'post_w2'), 'Post not found');
select test_expect_error(format($f$select public.persona_mode_toggle_reaction(%L, %L, 'like')$f$, :'pe', :'post_w2'), 'Post not found');
select test_expect_error(format($f$select public.report_content('post', %L, 'spam')$f$, :'post_w2'), 'Reported content was not found');
select test_expect_error(format($f$select public.report_content('comment', %L, 'spam')$f$, :'c_w_on_w2'), 'Reported content was not found');
reset role;

-- 5. The owner still sees the item and learns it is held by moderation.
select test_as(:'W');
set role authenticated;
select test_assert((select count(*) = 1 from public.posts where id = :'post_w2'), 'owner still reads own held post');
select test_assert(public.content_visibility_state('post', :'post_w2') = 'hidden_by_moderation', 'owner sees hidden_by_moderation');
select test_assert((select count(*) = 1 from public.my_persona_mode_feed(null, null, null, 100) where id = :'post_w2'), 'owner feed keeps own held post');
reset role;

-- 6. Viewer states agree with RLS and never reveal the other side's block.
select test_as(:'N');
set role authenticated;
select test_assert(public.content_visibility_state('post', :'post_w2') = 'hidden_by_my_block', 'north blocked west: hidden_by_my_block');
select test_assert(public.content_visibility_state('post', :'post_s') = 'unavailable', 'blocked by south reads as unavailable');
select test_assert(public.content_visibility_state('comment', :'c_n_on_s') = 'unavailable', 'own comment under a post whose author blocked me is unavailable');
select test_assert((select count(*) = 0 from public.comments where id = :'c_n_on_s'), 'and RLS hides it too');
select test_assert(public.content_visibility_state('persona', :'pn') = 'visible', 'own persona visible');
reset role;
select test_as(:'E');
set role authenticated;
select test_assert(public.content_visibility_state('comment', :'c_e_on_w2') = 'unavailable', 'own comment under a held post is unavailable');
select test_assert((select count(*) = 0 from public.comments where id = :'c_e_on_w2'), 'and RLS hides it too');
reset role;
select test_as(:'S');
set role authenticated;
select test_assert(public.content_visibility_state('post', :'post_n') = 'hidden_by_my_block', 'south blocked north: hidden_by_my_block');
reset role;
insert into public.blocks(blocker, blocked_persona, kind) values (:'E', :'pn', 'mute');
select test_as(:'E');
set role authenticated;
select test_assert(public.content_visibility_state('post', :'post_n') = 'hidden_by_my_mute', 'mute is its own state');
reset role;
delete from public.blocks where blocker = :'E' and blocked_persona = :'pn';
-- North blocking East's draft persona blocks East's whole account, so test it
-- on its own and lift it afterwards.
insert into public.blocks(blocker, blocked_persona, kind) values (:'N', :'pd', 'block');
select test_as(:'N');
set role authenticated;
select test_assert(public.content_visibility_state('post', :'post_d') = 'unavailable', 'blocking an unpublished persona does not reveal its posts');
reset role;
select test_as(:'E');
set role authenticated;
select test_assert(public.content_visibility_state('post', :'post_n') = 'unavailable', 'a block by North on any East persona hides North from East');
reset role;
delete from public.blocks where blocker = :'N' and blocked_persona = :'pd';

-- 7. Comment-level hold, including the post panel.
select test_as(:'E');
set role authenticated;
select test_assert((select count(*) = 1 from public.comments where id = :'c_w_on_e'), 'east sees west comment before hold');
reset role;
select test_as(:'T', 'aal2');
set role authenticated;
select test_assert((public.staff_set_content_hold('comment', :'c_w_on_e', true, 'spam')) ->> 'changed' = 'true', 'comment hold placed');
reset role;
select test_as(:'E');
set role authenticated;
select test_assert((select count(*) = 0 from public.comments where id = :'c_w_on_e'), 'held comment hidden from post owner east');
select test_assert(public.content_visibility_state('comment', :'c_w_on_e') = 'unavailable', 'held comment unavailable');
select test_assert(jsonb_array_length(public.my_persona_mode_post_panel(:'pe', :'post_e') -> 'comments') = 0, 'panel drops the held comment');
reset role;
select test_as(:'W');
set role authenticated;
select test_assert((select count(*) = 1 from public.comments where id = :'c_w_on_e'), 'comment author still reads own held comment');
select test_assert(public.content_visibility_state('comment', :'c_w_on_e') = 'hidden_by_moderation', 'comment author sees hidden_by_moderation');
reset role;

-- 8. Holds linked to a report write to its trail; lifting restores visibility.
select test_as(:'T', 'aal2');
set role authenticated;
select test_assert((public.staff_set_content_hold('post', :'post_w', true, 'privacy', :'rw2', 'address in post')) ->> 'changed' = 'true', 'linked hold placed');
select test_assert((public.staff_set_content_hold('post', :'post_w', false, 'other', :'rw2', 'edited by owner')) ->> 'changed' = 'true', 'linked hold lifted');
select test_assert((public.staff_set_content_hold('post', :'post_w2', false)) ->> 'changed' = 'true', 'post_w2 hold lifted');
select test_assert((public.staff_set_content_hold('post', :'post_w2', false)) ->> 'changed' = 'false', 'second lift is a no-op');
reset role;
select test_assert((
  select array_agg(event_type order by created_at, event_type) = array['created','hold_placed','hold_lifted']
  from public.content_report_events where report_id = :'rw2'
), 'report trail records hold placed and lifted');
select test_assert((
  select lifted_by = :'T'::uuid and note = E'address in post\nedited by owner'
  from public.content_moderation_holds where target_id = :'post_w' and report_id = :'rw2'
), 'lift records actor and appends note');
select test_as(:'E');
set role authenticated;
select test_assert((select count(*) = 1 from public.posts where id = :'post_w2'), 'east reads post_w2 again after lift');
select test_assert((select count(*) = 1 from public.my_persona_mode_feed(:'pe', null, null, 100) where id = :'post_w2'), 'post_w2 back in feed');
reset role;
select test_as(null);
set role anon;
select test_assert(public.content_visibility_state('post', :'post_w2') = 'visible', 'anonymous viewer sees lifted post as visible');
reset role;

\echo 'content holds runtime: passed'
