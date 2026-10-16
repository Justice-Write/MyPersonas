-- 080-content-reports-moderation-queue.sql
-- Content reports + staff moderation queue (AliaSpaces first-party safety slice).
-- Number 080 skips the 078/079 candidates on codex/identity-roadmap-20260927.
--
-- Adds the server-side report path that apps/social-mobile in aliaspaces.com has been
-- missing ("Content reports are not a first-party RPC yet"). Symmetric blocking is NOT
-- added here: persona_visible / can_request / persona_mode_can_view already enforce it
-- (20260822170000_publication_social_security_governance.sql).
--
-- Rules:
--   * Reports are written only through public.report_content(); no client table access.
--   * You can only report what you can currently see (persona_visible), so unknown,
--     unpublished, private-to-others, blocked and muted targets all fail with one
--     generic error and existence is not leaked. Report before you block.
--   * Own content cannot be reported. An optional acting persona must be owned.
--   * One active (open/triaged) report per reporter+target: repeats return the same id.
--   * 20 reports per account per hour.
--   * Staff (global_administrator or technician, AAL2) read and resolve via RPC only.
--     Resolving records a decision; it does not unpublish or delete anything. Actions
--     stay in their own owner-approved flows.
--   * Every staff status change appends to content_report_events (append-only).
-- Idempotent: safe to apply twice.

begin;

create table if not exists public.content_reports (
  id                  uuid primary key default gen_random_uuid(),
  reporter            uuid not null references public.profiles(id) on delete cascade,
  reporter_persona_id uuid references public.personas(id) on delete set null,
  target_kind         text not null check (target_kind in ('persona','post','comment')),
  target_id           uuid not null,
  target_persona_id   uuid not null references public.personas(id) on delete cascade,
  reason              text not null check (reason in ('spam','harassment','impersonation','illegal','other')),
  details             text not null default '' check (char_length(details) <= 400),
  status              text not null default 'open' check (status in ('open','triaged','actioned','dismissed')),
  assigned_to         uuid references public.profiles(id) on delete set null,
  staff_notes         text not null default '' check (char_length(staff_notes) <= 4000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint content_reports_resolution_consistent
    check ((status in ('actioned','dismissed')) = (resolved_at is not null))
);

create unique index if not exists content_reports_one_active_per_target
  on public.content_reports(reporter, target_kind, target_id)
  where status in ('open','triaged');
create index if not exists content_reports_queue_idx
  on public.content_reports(status, created_at);
create index if not exists content_reports_reporter_recent_idx
  on public.content_reports(reporter, created_at);
create index if not exists content_reports_target_persona_idx
  on public.content_reports(target_persona_id);

create table if not exists public.content_report_events (
  id          bigint generated always as identity primary key,
  report_id   uuid not null references public.content_reports(id) on delete cascade,
  actor       uuid references public.profiles(id) on delete set null,
  from_status text not null,
  to_status   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists content_report_events_report_idx
  on public.content_report_events(report_id, created_at);

alter table public.content_reports enable row level security;
alter table public.content_report_events enable row level security;
-- No policies on purpose: with RLS on and no policy, anon/authenticated see nothing.
revoke all on public.content_reports, public.content_report_events from public, anon, authenticated;

create or replace function public.report_content(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default '',
  p_reporter_persona_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_persona uuid;
  v_post_persona uuid;
  v_existing uuid;
  v_recent integer;
  v_id uuid;
  v_details text := btrim(coalesce(p_details, ''));
begin
  if v_uid is null then
    raise sqlstate '28000' using message = 'Authentication required';
  end if;
  if p_target_kind is null or p_target_kind not in ('persona','post','comment')
     or p_target_id is null then
    raise exception 'Invalid report target';
  end if;
  if p_reason is null or p_reason not in ('spam','harassment','impersonation','illegal','other') then
    raise exception 'Invalid report reason';
  end if;
  if char_length(v_details) > 400 then
    raise exception 'Report details are too long';
  end if;
  if p_reporter_persona_id is not null and not exists (
    select 1 from public.personas mine
    where mine.id = p_reporter_persona_id and mine.owner = v_uid
  ) then
    raise exception 'Reporting persona must be your own';
  end if;

  if p_target_kind = 'persona' then
    v_target_persona := p_target_id;
  elsif p_target_kind = 'post' then
    select post.persona_id into v_target_persona from public.posts post where post.id = p_target_id;
  else
    select comment.persona_id, post.persona_id into v_target_persona, v_post_persona
    from public.comments comment
    join public.posts post on post.id = comment.post_id
    where comment.id = p_target_id;
  end if;

  -- One generic error for missing, invisible, blocked or muted targets: no existence oracle.
  if v_target_persona is null
     or not public.persona_visible(v_target_persona)
     or (v_post_persona is not null and not public.persona_visible(v_post_persona)) then
    raise exception 'Reportable content not found';
  end if;
  if exists (select 1 from public.personas p where p.id = v_target_persona and p.owner = v_uid) then
    raise exception 'You cannot report your own content';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 61016));

  select report.id into v_existing
  from public.content_reports report
  where report.reporter = v_uid and report.target_kind = p_target_kind
    and report.target_id = p_target_id and report.status in ('open','triaged');
  if v_existing is not null then
    return v_existing;
  end if;

  select count(*) into v_recent from public.content_reports report
  where report.reporter = v_uid and report.created_at >= now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Report limit reached; try again later';
  end if;

  insert into public.content_reports(
    reporter, reporter_persona_id, target_kind, target_id, target_persona_id, reason, details)
  values (v_uid, p_reporter_persona_id, p_target_kind, p_target_id, v_target_persona, p_reason, v_details)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.staff_list_content_reports(
  p_status text default 'open',
  p_limit integer default 50
) returns table (
  id uuid, target_kind text, target_id uuid, target_persona_id uuid, target_handle text,
  reason text, details text, status text, reporter uuid, reporter_persona_id uuid,
  assigned_to uuid, staff_notes text, active_reports_on_target bigint,
  created_at timestamptz, resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_role(array['global_administrator','technician']::text[]) then
    raise exception 'Staff role required';
  end if;
  perform public.require_aal2();
  if p_status is null or p_status not in ('open','triaged','actioned','dismissed') then
    raise exception 'Invalid report status';
  end if;
  return query
  select report.id, report.target_kind, report.target_id, report.target_persona_id, persona.handle,
         report.reason, report.details, report.status, report.reporter, report.reporter_persona_id,
         report.assigned_to, report.staff_notes,
         (select count(*) from public.content_reports other
           where other.target_kind = report.target_kind and other.target_id = report.target_id
             and other.status in ('open','triaged')),
         report.created_at, report.resolved_at
  from public.content_reports report
  left join public.personas persona on persona.id = report.target_persona_id
  where report.status = p_status
  order by report.created_at
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.staff_resolve_content_report(
  p_report_id uuid,
  p_status text,
  p_staff_notes text default '',
  p_assigned_to uuid default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.has_platform_role(array['global_administrator','technician']::text[]) then
    raise exception 'Staff role required';
  end if;
  perform public.require_aal2();
  if p_status is null or p_status not in ('triaged','actioned','dismissed') then
    raise exception 'Invalid staff status';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.platform_role_assignments assignment
    where assignment.account_id = p_assigned_to and assignment.active
      and assignment.role_key in ('global_administrator','technician')
      and (assignment.expires_at is null or assignment.expires_at > now())
  ) then
    raise exception 'Assignee must be an active administrator or technician';
  end if;

  select report.status into v_old from public.content_reports report
  where report.id = p_report_id for update;
  if v_old is null then
    raise exception 'Report not found';
  end if;
  if v_old in ('actioned','dismissed') then
    raise exception 'Report is already resolved';
  end if;

  update public.content_reports
  set status = p_status,
      staff_notes = left(coalesce(p_staff_notes, ''), 4000),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      resolved_at = case when p_status in ('actioned','dismissed') then now() else null end,
      updated_at = now()
  where id = p_report_id;

  insert into public.content_report_events(report_id, actor, from_status, to_status)
  values (p_report_id, auth.uid(), v_old, p_status);
  return true;
end;
$$;

revoke all on function public.report_content(text, uuid, text, text, uuid) from public, anon;
revoke all on function public.staff_list_content_reports(text, integer) from public, anon;
revoke all on function public.staff_resolve_content_report(uuid, text, text, uuid) from public, anon;
grant execute on function public.report_content(text, uuid, text, text, uuid) to authenticated;
grant execute on function public.staff_list_content_reports(text, integer) to authenticated;
grant execute on function public.staff_resolve_content_report(uuid, text, text, uuid) to authenticated;

commit;
