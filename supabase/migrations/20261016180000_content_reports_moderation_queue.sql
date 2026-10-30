-- 080-content-reports-moderation-queue.sql
-- Content reports and a staff review queue (AliaSpaces first-party safety slice).
-- Number 080 skips the 078/079 candidates on codex/identity-roadmap-20260927.
--
-- This file supersedes the first 080 draft from 2026-10-16. The owner chose the
-- reviewed design from aliaspaces branch codex/aliaspaces-m2-reports-20261016.
-- The RPC name report_content is kept so the merged aliaspaces client works
-- unchanged. Symmetric blocking is NOT added here: persona_visible and
-- persona_mode_can_view already enforce it (20260822170000).
--
-- Adds
--   schema moderation_private          helpers PostgREST never exposes
--   content_reports                    one row per (reporter, target) report
--   content_report_events              append-only trail with before/after values
--   report_content()                   a signed-in reporter files a report
--   my_content_reports()               reporter-safe projection of the caller's reports
--   staff_list_content_reports()       staff read model (role + AAL2)
--   staff_review_content_report()      staff transition (role + AAL2 + recusal)
--
-- Guarantees
--   * No Data API role reads or writes the tables directly. Every path is a
--     SECURITY DEFINER RPC with search_path = ''. Internal helpers live in
--     moderation_private, which must never be added to PostgREST's exposed schemas.
--   * The reported party has no read path and no write path. A staff member never
--     sees, in the queue, reports about content they own.
--   * Evidence survives deletion. Reports keep the target ids and a 2,000-character
--     excerpt without foreign keys to the target, so deleting the reported persona,
--     post or comment does not erase reports about it.
--   * A reporter can report what they can currently see, or what they would see if
--     their own block or mute of the author did not exist (report-then-block and
--     block-then-report both work). Everything else, including content hidden
--     because the author blocked the reporter, gets one "not found" error. Adding
--     or removing your own rule never reveals the other side's.
--   * Self-reports are refused. A repeat report of a target that still has an
--     unresolved report from the same reporter returns that report, also under
--     concurrency. 20 reports per hour and 100 per day per reporter.
--   * Staff calls need global_administrator or technician, an AAL2 session, and
--     recusal when the staff member is the reporter or owns the target. Resolving
--     records a decision; it never unpublishes or deletes anything.
--
-- Moderation holds that hide content are a separate, fail-closed follow-up:
-- 081-content-moderation-holds.DRAFT.sql.
--
-- Idempotent: safe to apply twice. Tested by scripts/test-content-reports-sql.sh
-- (or .ps1 on Windows, which runs the same script in a postgres:16 container).

begin;

create schema if not exists moderation_private;
revoke all on schema moderation_private from public;

create table if not exists public.content_reports (
  id                  uuid primary key default gen_random_uuid(),
  reporter            uuid references public.profiles(id) on delete set null,
  reporter_persona_id uuid references public.personas(id) on delete set null,
  target_kind         text not null check (target_kind in ('persona','post','comment')),
  target_id           uuid not null,
  -- Evidence outlives the target: these ids carry no foreign key on purpose.
  target_persona_id   uuid not null,
  target_post_id      uuid,
  target_owner        uuid,
  target_excerpt      text not null default '' check (char_length(target_excerpt) <= 2000),
  reason              text not null check (reason in (
                        'spam','harassment','hate','sexual_content','violence',
                        'self_harm','impersonation','privacy','intellectual_property','illegal','other')),
  details             text not null default '' check (char_length(details) <= 2000),
  state               text not null default 'open'
                      check (state in ('open','needs_review','resolved')),
  resolution          text not null default '' check (resolution in (
                        '','no_violation','action_taken','duplicate','out_of_scope')),
  assigned_to         uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint content_reports_target_shape check (
    (target_kind = 'persona' and target_id = target_persona_id and target_post_id is null)
    or (target_kind = 'post' and target_post_id = target_id)
    or (target_kind = 'comment' and target_post_id is not null and target_post_id <> target_id)
  ),
  constraint content_reports_resolution_shape check (
    ((state = 'resolved') = (resolution <> ''))
    and ((state = 'resolved') = (resolved_at is not null))
  )
);

create table if not exists public.content_report_events (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.content_reports(id) on delete cascade,
  actor_id         uuid references public.profiles(id) on delete set null,
  event_type       text not null check (event_type in (
                     'created','triaged','assigned','resolved','reopened',
                     'resolution_changed','commented','hold_placed','hold_lifted')),
  from_state       text not null default '',
  to_state         text not null default '',
  from_resolution  text not null default '',
  to_resolution    text not null default '',
  from_assignee    uuid,
  to_assignee      uuid,
  note             text not null default '' check (char_length(note) <= 4000),
  created_at       timestamptz not null default now()
);

create unique index if not exists content_reports_one_unresolved
  on public.content_reports(reporter, target_kind, target_id)
  where state <> 'resolved' and reporter is not null;
create index if not exists content_reports_queue_idx
  on public.content_reports(state, created_at, id)
  where state <> 'resolved';
create index if not exists content_reports_target_idx
  on public.content_reports(target_kind, target_id);
create index if not exists content_reports_reporter_idx
  on public.content_reports(reporter, created_at desc);
create index if not exists content_report_events_report_idx
  on public.content_report_events(report_id, created_at);

alter table public.content_reports enable row level security;
alter table public.content_report_events enable row level security;
-- No policies: with RLS on and every grant revoked, the Data API cannot reach
-- these tables. The RPCs below are the only interface.
revoke all on public.content_reports, public.content_report_events
  from public, anon, authenticated;
grant all on public.content_reports, public.content_report_events
  to service_role;

-- persona_visible(uuid) minus the owner branch and minus the caller's own
-- block/mute of this persona: "would I see it if I had not blocked or muted
-- it?" Every other production rule is kept, including the author's block of
-- the caller, publication dependencies and private friendships.
create or replace function moderation_private.persona_viewable_ignoring_own_rule(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personas persona
    where persona.id = pid
      and public.persona_publication_is_current(persona.id)
      and not exists (
        select 1
        from public.persona_publication_dependencies dependency
        join public.personas relative
          on relative.id = dependency.dependency_persona_id
        where dependency.persona_id = persona.id and (
          exists (
            select 1 from public.blocks hidden_dependency
            where hidden_dependency.blocker = auth.uid()
              and hidden_dependency.blocked_persona = relative.id
              and hidden_dependency.kind in ('block','mute')
          )
          or exists (
            select 1 from public.blocks dependency_blocked_viewer
            join public.personas viewer_persona
              on viewer_persona.id = dependency_blocked_viewer.blocked_persona
             and viewer_persona.owner = auth.uid()
            where dependency_blocked_viewer.blocker = relative.owner
              and dependency_blocked_viewer.kind = 'block'
          )
        )
      )
      and not exists (
        select 1 from public.blocks blocked
        join public.personas mine on mine.id = blocked.blocked_persona and mine.owner = auth.uid()
        where blocked.blocker = persona.owner and blocked.kind = 'block'
      )
      and (
        persona.visibility in ('public','unlisted')
        or (persona.visibility = 'private' and exists (
          select 1 from public.follows friendship
          join public.personas mine on (
            (friendship.follower = persona.id and mine.id = friendship.target)
            or (friendship.target = persona.id and mine.id = friendship.follower)
          )
          where friendship.status = 'accepted' and mine.owner = auth.uid()
        ))
      )
  )
$$;

-- The caller's own rule on a persona: 'block', 'mute', or null.
create or replace function moderation_private.own_rule_kind(pid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rule.kind
  from public.blocks rule
  where rule.blocker = auth.uid()
    and rule.blocked_persona = pid
    and rule.kind in ('block','mute')
  order by case rule.kind when 'block' then 0 else 1 end
  limit 1
$$;

create or replace function moderation_private.report_persona_reachable(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.persona_visible(pid)
    or (moderation_private.own_rule_kind(pid) is not null
        and moderation_private.persona_viewable_ignoring_own_rule(pid))
$$;

-- Content hidden by moderation reads as not found. 3b replaces this body once
-- moderation holds exist.
create or replace function moderation_private.report_content_hidden(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create or replace function public.report_content(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default '',
  p_reporter_persona_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_details text := btrim(coalesce(p_details, ''));
  v_persona_id uuid;
  v_post_id uuid;
  v_owner uuid;
  v_excerpt text := '';
  v_existing public.content_reports%rowtype;
  v_hour integer := 0;
  v_day integer := 0;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_target_kind is null or p_target_kind not in ('persona','post','comment')
     or p_target_id is null then
    raise exception 'Invalid report target';
  end if;
  if p_reason is null or p_reason not in (
    'spam','harassment','hate','sexual_content','violence',
    'self_harm','impersonation','privacy','intellectual_property','illegal','other'
  ) then
    raise exception 'Invalid report reason';
  end if;
  if char_length(v_details) > 2000 then raise exception 'Report details are too long'; end if;
  if p_reporter_persona_id is not null and not exists (
    select 1 from public.personas persona
    where persona.id = p_reporter_persona_id and persona.owner = v_uid
  ) then
    raise exception 'Acting persona must be yours';
  end if;

  if p_target_kind = 'persona' then
    select persona.id, null::uuid, persona.owner,
           left(concat_ws(' · ', persona.handle, persona.name, persona.tagline), 2000)
      into v_persona_id, v_post_id, v_owner, v_excerpt
    from public.personas persona
    where persona.id = p_target_id
      and moderation_private.report_persona_reachable(persona.id);
  elsif p_target_kind = 'post' then
    select post.persona_id, post.id, persona.owner,
           left(concat_ws(E'\n', nullif(post.title, ''), post.body), 2000)
      into v_persona_id, v_post_id, v_owner, v_excerpt
    from public.posts post
    join public.personas persona on persona.id = post.persona_id
    where post.id = p_target_id
      and moderation_private.report_persona_reachable(post.persona_id);
  else
    select reported_comment.persona_id, reported_comment.post_id, persona.owner,
           left(reported_comment.body, 2000)
      into v_persona_id, v_post_id, v_owner, v_excerpt
    from public.comments reported_comment
    join public.personas persona on persona.id = reported_comment.persona_id
    join public.posts parent_post on parent_post.id = reported_comment.post_id
    where reported_comment.id = p_target_id
      and moderation_private.report_persona_reachable(reported_comment.persona_id)
      and moderation_private.report_persona_reachable(parent_post.persona_id);
  end if;

  -- One message for missing, hidden, unpublished, held, and blocked-by-author.
  if v_persona_id is null
     or (v_owner is distinct from v_uid
         and moderation_private.report_content_hidden(p_target_kind, p_target_id)) then
    raise exception 'Reported content was not found';
  end if;
  if v_owner = v_uid then raise exception 'You cannot report your own content'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 51061));

  select * into v_existing
  from public.content_reports report
  where report.reporter = v_uid
    and report.target_kind = p_target_kind
    and report.target_id = p_target_id
    and report.state <> 'resolved';
  if found then
    return jsonb_build_object('id', v_existing.id, 'state', v_existing.state, 'duplicate', true);
  end if;

  select count(*) filter (where report.created_at >= now() - interval '1 hour'), count(*)
    into v_hour, v_day
  from public.content_reports report
  where report.reporter = v_uid and report.created_at >= now() - interval '1 day';
  if v_hour >= 20 or v_day >= 100 then
    raise exception 'Report limit reached; try again later';
  end if;

  begin
    insert into public.content_reports(
      reporter, reporter_persona_id, target_kind, target_id, target_persona_id,
      target_post_id, target_owner, target_excerpt, reason, details
    ) values (
      v_uid, p_reporter_persona_id, p_target_kind, p_target_id, v_persona_id,
      case when p_target_kind = 'persona' then null else v_post_id end,
      v_owner, coalesce(v_excerpt, ''), p_reason, v_details
    ) returning id into v_id;
  exception when unique_violation then
    -- Staff reopened an earlier report on this target while we were inserting.
    select * into v_existing
    from public.content_reports report
    where report.reporter = v_uid
      and report.target_kind = p_target_kind
      and report.target_id = p_target_id
      and report.state <> 'resolved';
    return jsonb_build_object('id', v_existing.id, 'state', v_existing.state, 'duplicate', true);
  end;

  insert into public.content_report_events(report_id, actor_id, event_type, to_state)
  values (v_id, v_uid, 'created', 'open');

  return jsonb_build_object('id', v_id, 'state', 'open', 'duplicate', false);
end;
$$;

create or replace function public.my_content_reports(p_limit integer default 50)
returns table(
  id uuid,
  target_kind text,
  target_id uuid,
  reason text,
  state text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select report.id, report.target_kind, report.target_id, report.reason, report.state,
         report.created_at, report.updated_at
  from public.content_reports report
  where report.reporter = auth.uid()
  order by report.created_at desc, report.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Oldest first. Page with the last row's (created_at, id) as (p_after, p_after_id).
create or replace function public.staff_list_content_reports(
  p_state text default null,
  p_limit integer default 50,
  p_after timestamptz default null,
  p_after_id uuid default null
)
returns table(
  id uuid,
  state text,
  resolution text,
  reason text,
  details text,
  target_kind text,
  target_id uuid,
  target_persona_id uuid,
  target_post_id uuid,
  target_owner uuid,
  target_handle text,
  target_excerpt text,
  target_still_exists boolean,
  reporter uuid,
  reporter_persona_id uuid,
  assigned_to uuid,
  unresolved_reports_on_target bigint,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_platform_role(array['global_administrator','technician']::text[]) then
    raise exception 'Staff role required';
  end if;
  perform public.require_aal2();
  if p_state is not null and p_state not in ('open','needs_review','resolved') then
    raise exception 'Invalid report state';
  end if;
  return query
  select report.id, report.state, report.resolution, report.reason, report.details,
         report.target_kind, report.target_id, report.target_persona_id, report.target_post_id,
         report.target_owner, persona.handle, report.target_excerpt,
         case report.target_kind
           when 'persona' then exists (
             select 1 from public.personas still where still.id = report.target_id)
           when 'post' then exists (
             select 1 from public.posts still where still.id = report.target_id)
           else exists (
             select 1 from public.comments still where still.id = report.target_id)
         end,
         report.reporter, report.reporter_persona_id, report.assigned_to,
         (select count(*) from public.content_reports peer
           where peer.target_kind = report.target_kind
             and peer.target_id = report.target_id
             and peer.state <> 'resolved'),
         report.created_at, report.updated_at, report.resolved_at
  from public.content_reports report
  left join public.personas persona on persona.id = report.target_persona_id
  where ((p_state is null and report.state <> 'resolved') or report.state = p_state)
    and (
      p_after is null
      or report.created_at > p_after
      or (report.created_at = p_after and p_after_id is not null and report.id > p_after_id)
    )
    and report.target_owner is distinct from auth.uid()
  order by report.created_at asc, report.id asc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- p_assigned_to null keeps the current assignee; p_unassign clears it.
create or replace function public.staff_review_content_report(
  p_report_id uuid,
  p_state text,
  p_resolution text default '',
  p_assigned_to uuid default null,
  p_note text default '',
  p_unassign boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.content_reports%rowtype;
  v_resolution text := coalesce(p_resolution, '');
  v_note text := btrim(coalesce(p_note, ''));
  v_assignee uuid;
  v_event text;
begin
  if not public.has_platform_role(array['global_administrator','technician']::text[]) then
    raise exception 'Staff role required';
  end if;
  perform public.require_aal2();
  if p_state is null or p_state not in ('open','needs_review','resolved') then
    raise exception 'Invalid report state';
  end if;
  if p_state = 'resolved'
     and v_resolution not in ('no_violation','action_taken','duplicate','out_of_scope') then
    raise exception 'A resolution is required to resolve a report';
  end if;
  if p_state <> 'resolved' and v_resolution <> '' then
    raise exception 'Only resolved reports carry a resolution';
  end if;
  if coalesce(p_unassign, false) and p_assigned_to is not null then
    raise exception 'Choose an assignee or unassign, not both';
  end if;
  if char_length(v_note) > 4000 then raise exception 'Note is too long'; end if;

  select * into v_report
  from public.content_reports report
  where report.id = p_report_id
  for update;
  if not found then raise exception 'Report not found'; end if;
  if v_uid = v_report.target_owner or v_uid = v_report.reporter then
    raise exception 'Recusal required: you are a party to this report';
  end if;
  if v_report.state = 'resolved' and p_state = 'open' then
    raise exception 'Reopen a resolved report as needs_review';
  end if;
  if v_report.state = 'resolved' and p_state <> 'resolved' and exists (
    select 1 from public.content_reports newer
    where newer.reporter = v_report.reporter
      and newer.target_kind = v_report.target_kind
      and newer.target_id = v_report.target_id
      and newer.state <> 'resolved'
      and newer.id <> v_report.id
  ) then
    raise exception 'The reporter has a newer unresolved report on this target; work that one or resolve it as duplicate first';
  end if;

  v_assignee := case
    when coalesce(p_unassign, false) then null
    when p_assigned_to is not null then p_assigned_to
    else v_report.assigned_to
  end;
  if p_assigned_to is not null and (
    p_assigned_to = v_report.target_owner or p_assigned_to = v_report.reporter
  ) then
    raise exception 'Assignee is a party to this report';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.platform_role_assignments assignment
    where assignment.account_id = p_assigned_to
      and assignment.active
      and assignment.role_key in ('global_administrator','technician')
      and (assignment.expires_at is null or assignment.expires_at > now())
  ) then
    raise exception 'Assignee must be an active administrator or technician';
  end if;

  begin
    update public.content_reports report
    set state = p_state,
        resolution = case when p_state = 'resolved' then v_resolution else '' end,
        assigned_to = v_assignee,
        resolved_at = case
          when p_state <> 'resolved' then null
          when v_report.state = 'resolved' then v_report.resolved_at
          else now()
        end,
        updated_at = now()
    where report.id = p_report_id;
  exception when unique_violation then
    raise exception 'The reporter has a newer unresolved report on this target; work that one or resolve it as duplicate first';
  end;

  v_event := case
    when p_state = 'resolved' and v_report.state <> 'resolved' then 'resolved'
    when v_report.state = 'resolved' and p_state <> 'resolved' then 'reopened'
    when p_state is distinct from v_report.state then 'triaged'
    when p_state = 'resolved' and v_resolution is distinct from v_report.resolution then 'resolution_changed'
    when v_assignee is distinct from v_report.assigned_to then 'assigned'
    else 'commented'
  end;
  insert into public.content_report_events(
    report_id, actor_id, event_type, from_state, to_state,
    from_resolution, to_resolution, from_assignee, to_assignee, note
  ) values (
    p_report_id, v_uid, v_event, v_report.state, p_state,
    v_report.resolution, case when p_state = 'resolved' then v_resolution else '' end,
    v_report.assigned_to, v_assignee, v_note
  );

  return jsonb_build_object(
    'id', p_report_id,
    'state', p_state,
    'resolution', case when p_state = 'resolved' then v_resolution else '' end,
    'assigned_to', v_assignee,
    'event', v_event
  );
end;
$$;

revoke all on function moderation_private.persona_viewable_ignoring_own_rule(uuid),
  moderation_private.own_rule_kind(uuid),
  moderation_private.report_persona_reachable(uuid),
  moderation_private.report_content_hidden(text,uuid)
  from public, anon, authenticated;
revoke all on function public.report_content(text,uuid,text,text,uuid)
  from public, anon;
revoke all on function public.my_content_reports(integer)
  from public, anon;
revoke all on function public.staff_list_content_reports(text,integer,timestamptz,uuid)
  from public, anon;
revoke all on function public.staff_review_content_report(uuid,text,text,uuid,text,boolean)
  from public, anon;
grant execute on function public.report_content(text,uuid,text,text,uuid)
  to authenticated;
grant execute on function public.my_content_reports(integer)
  to authenticated;
grant execute on function public.staff_list_content_reports(text,integer,timestamptz,uuid)
  to authenticated;
grant execute on function public.staff_review_content_report(uuid,text,text,uuid,text,boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
