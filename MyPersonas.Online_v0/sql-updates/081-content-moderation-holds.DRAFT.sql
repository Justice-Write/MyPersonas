-- 081-content-moderation-holds.DRAFT.sql
-- STATUS: DRAFT. Do not mirror into supabase/migrations until it is adopted.
-- Apply only after 080-content-reports-moderation-queue.sql.
--
-- Moderation holds on posts and comments, kept distinct from blocks.
--
-- Adds
--   content_moderation_holds               one active hold per post or comment
--   moderation_private.content_held()      predicate for RLS and social RPCs.
--                                          Callers get EXECUTE (RLS checks it at run
--                                          time) but no USAGE on the schema, so they
--                                          cannot name it, and PostgREST does not
--                                          expose it
--   content_visibility_state()             per-viewer state for one item
--   staff_set_content_hold()               place or lift a hold (role + AAL2 + recusal)
-- Changes
--   RLS read policies "posts visible read", "comments read", "reactions read"
--   (ALTER POLICY: roles stay as they are) keep their block/visibility rule and
--   also exclude held content. Owners still see their own held item.
--   moderation_private.report_content_hidden() now treats held content as not
--   found, so a report cannot be used to probe for it.
--
-- Viewer states returned by content_visibility_state()
--   visible               the caller can read it
--   hidden_by_my_block    the caller blocked the author, and would otherwise see it
--   hidden_by_my_mute     the caller muted the author, and would otherwise see it
--   hidden_by_moderation  returned only to the content owner
--   unavailable           everything else: missing, unpublished, held (for
--                         non-owners), or the author blocked the caller. The
--                         state always agrees with what RLS returns.
--
-- Fails closed on adoption. SECURITY DEFINER functions owned by the table owner
-- bypass RLS. Before COMMIT this file checks every SECURITY DEFINER function
-- that anon or authenticated can execute and that reads public.posts,
-- public.comments or public.reactions:
--   * the seven viewer and interaction RPCs listed in v_filters must call
--     moderation_private.content_held (outside comments). Add those filters at
--     the marker below, in this same transaction;
--   * every other such function must be on the reviewed owner-scoped list.
-- It also refuses owner-rights views over those tables and any read policy on
-- them that this file does not know. Any failure rolls the whole file back.
--
-- Not covered: persona-level moderation. Hiding a whole persona needs a change
-- to persona_visible(uuid), which has more than thirty dependents. That is a
-- separate owner decision.

begin;

-- Fail early if production read policies differ from the reviewed set.
do $$
declare
  v_unexpected text;
begin
  select string_agg(policy.tablename || ': ' || policy.policyname, ', ') into v_unexpected
  from pg_catalog.pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename in ('posts','comments','reactions')
    and policy.permissive = 'PERMISSIVE'
    and policy.cmd in ('SELECT','ALL')
    and (policy.tablename, policy.policyname) not in (
      ('posts','posts visible read'),
      ('posts','posts owner write'),
      ('comments','comments read'),
      ('reactions','reactions read')
    );
  if v_unexpected is not null then
    raise exception 'Unreviewed read policy would bypass moderation holds: %', v_unexpected;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies policy
    where policy.schemaname = 'public' and policy.tablename = 'posts'
      and policy.policyname = 'posts owner write' and policy.qual ~ 'owns_persona'
  ) then
    raise exception 'posts owner write is no longer owner-scoped; review before adding holds';
  end if;
end;
$$;

create table if not exists public.content_moderation_holds (
  id          uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('post','comment')),
  target_id   uuid not null,
  report_id   uuid references public.content_reports(id) on delete set null,
  reason      text not null check (reason in (
                'spam','harassment','hate','sexual_content','violence',
                'self_harm','impersonation','privacy','intellectual_property','illegal','other')),
  placed_by   uuid references public.profiles(id) on delete set null,
  placed_at   timestamptz not null default now(),
  lifted_by   uuid references public.profiles(id) on delete set null,
  lifted_at   timestamptz,
  note        text not null default '' check (char_length(note) <= 4000),
  constraint content_moderation_holds_lift_shape check (lifted_at is not null or lifted_by is null)
);

create unique index if not exists content_moderation_holds_one_active
  on public.content_moderation_holds(target_kind, target_id)
  where lifted_at is null;
create index if not exists content_moderation_holds_report_idx
  on public.content_moderation_holds(report_id)
  where report_id is not null;

alter table public.content_moderation_holds enable row level security;
revoke all on public.content_moderation_holds from public, anon, authenticated;
grant all on public.content_moderation_holds to service_role;

create or replace function moderation_private.content_held(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_moderation_holds hold
    where hold.target_kind = p_kind
      and hold.target_id = p_id
      and hold.lifted_at is null
  )
$$;

create or replace function moderation_private.report_content_hidden(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'post' then moderation_private.content_held('post', p_id)
    when 'comment' then moderation_private.content_held('comment', p_id)
      or exists (
        select 1 from public.comments item
        where item.id = p_id and moderation_private.content_held('post', item.post_id)
      )
    else false
  end
$$;

create or replace function public.content_visibility_state(p_kind text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_persona uuid;
  v_owner uuid;
  v_post uuid;
  v_post_persona uuid;
  v_post_owner uuid;
  v_item_held boolean := false;
  v_post_held boolean := false;
  v_check uuid;
  v_rule text;
begin
  if p_kind = 'persona' then
    select persona.id, persona.owner into v_persona, v_owner
    from public.personas persona where persona.id = p_id;
  elsif p_kind = 'post' then
    select post.persona_id, persona.owner, post.id
      into v_persona, v_owner, v_post
    from public.posts post
    join public.personas persona on persona.id = post.persona_id
    where post.id = p_id;
    v_post_persona := v_persona;
    v_post_owner := v_owner;
  elsif p_kind = 'comment' then
    select item.persona_id, author.owner, item.post_id, parent.persona_id, parent_author.owner
      into v_persona, v_owner, v_post, v_post_persona, v_post_owner
    from public.comments item
    join public.personas author on author.id = item.persona_id
    join public.posts parent on parent.id = item.post_id
    join public.personas parent_author on parent_author.id = parent.persona_id
    where item.id = p_id;
  else
    raise exception 'Invalid content kind';
  end if;

  if v_persona is null then return 'unavailable'; end if;
  if p_kind in ('post','comment') then
    v_item_held := moderation_private.content_held(p_kind, p_id);
    v_post_held := moderation_private.content_held('post', v_post);
  end if;

  -- The caller's own item: moderation is the only thing that can hide it,
  -- except that a comment also needs its parent post to be readable.
  if v_uid is not null and v_owner = v_uid then
    if v_item_held then return 'hidden_by_moderation'; end if;
    if p_kind <> 'comment' or v_post_owner = v_uid then return 'visible'; end if;
  end if;

  -- Every persona the item depends on must be visible, as in RLS. A persona
  -- hidden only by the caller's own rule reports that rule.
  foreach v_check in array array[v_persona, v_post_persona] loop
    continue when v_check is null or (v_uid is not null and v_check = v_persona and v_owner = v_uid);
    if not public.persona_visible(v_check) then
      v_rule := moderation_private.own_rule_kind(v_check);
      if v_rule is not null and moderation_private.persona_viewable_ignoring_own_rule(v_check) then
        return 'hidden_by_my_' || v_rule;
      end if;
      return 'unavailable';
    end if;
  end loop;

  if p_kind in ('post','comment') and v_item_held and v_owner is distinct from v_uid then
    return 'unavailable';
  end if;
  if p_kind = 'comment' and v_post_held and v_post_owner is distinct from v_uid then
    return 'unavailable';
  end if;
  return 'visible';
end;
$$;

create or replace function public.staff_set_content_hold(
  p_target_kind text,
  p_target_id uuid,
  p_hold boolean,
  p_reason text default 'other',
  p_report_id uuid default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_report public.content_reports%rowtype;
  v_hold uuid;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not public.has_platform_role(array['global_administrator','technician']::text[]) then
    raise exception 'Staff role required';
  end if;
  perform public.require_aal2();
  if p_target_kind is null or p_target_kind not in ('post','comment')
     or p_target_id is null or p_hold is null then
    raise exception 'Invalid moderation hold';
  end if;
  if char_length(v_note) > 4000 then raise exception 'Note is too long'; end if;

  if p_target_kind = 'post' then
    select persona.owner into v_owner
    from public.posts post
    join public.personas persona on persona.id = post.persona_id
    where post.id = p_target_id;
  else
    select persona.owner into v_owner
    from public.comments item
    join public.personas persona on persona.id = item.persona_id
    where item.id = p_target_id;
  end if;
  if v_owner is null then raise exception 'Moderation target not found'; end if;
  if v_owner = v_uid then raise exception 'Recusal required: you own this content'; end if;
  -- Linked or not, a staff member who reported this content does not moderate it.
  if exists (
    select 1 from public.content_reports mine
    where mine.reporter = v_uid
      and mine.target_kind = p_target_kind
      and mine.target_id = p_target_id
  ) then
    raise exception 'Recusal required: you reported this content';
  end if;

  if p_report_id is not null then
    select * into v_report
    from public.content_reports report
    where report.id = p_report_id
    for update;
    if not found or v_report.target_kind <> p_target_kind or v_report.target_id <> p_target_id then
      raise exception 'Report does not match this target';
    end if;
  end if;

  if p_hold then
    if p_reason is null or p_reason not in (
      'spam','harassment','hate','sexual_content','violence',
      'self_harm','impersonation','privacy','intellectual_property','illegal','other'
    ) then
      raise exception 'Invalid moderation reason';
    end if;
    insert into public.content_moderation_holds(
      target_kind, target_id, report_id, reason, placed_by, note
    ) values (p_target_kind, p_target_id, p_report_id, p_reason, v_uid, v_note)
    on conflict (target_kind, target_id) where lifted_at is null do nothing
    returning id into v_hold;
    if v_hold is null then
      select hold.id into v_hold
      from public.content_moderation_holds hold
      where hold.target_kind = p_target_kind
        and hold.target_id = p_target_id
        and hold.lifted_at is null;
      return jsonb_build_object('hold_id', v_hold, 'held', true, 'changed', false);
    end if;
  else
    update public.content_moderation_holds hold
    set lifted_at = now(),
        lifted_by = v_uid,
        note = case when v_note = '' then hold.note
                    else left(concat_ws(E'\n', nullif(hold.note, ''), v_note), 4000) end
    where hold.target_kind = p_target_kind
      and hold.target_id = p_target_id
      and hold.lifted_at is null
    returning hold.id into v_hold;
    if v_hold is null then
      return jsonb_build_object('hold_id', null, 'held', false, 'changed', false);
    end if;
  end if;

  if p_report_id is not null then
    insert into public.content_report_events(
      report_id, actor_id, event_type, from_state, to_state, note
    ) values (
      p_report_id, v_uid,
      case when p_hold then 'hold_placed' else 'hold_lifted' end,
      v_report.state, v_report.state, v_note
    );
  end if;

  return jsonb_build_object('hold_id', v_hold, 'held', p_hold, 'changed', true);
end;
$$;

-- Read policies: same block/visibility rule, plus moderation holds. ALTER keeps
-- each policy's roles and fails if the policy is missing.
alter policy "posts visible read" on public.posts using (
  public.persona_visible(persona_id)
  and (public.owns_persona(persona_id) or not moderation_private.content_held('post', id))
);

alter policy "comments read" on public.comments using (
  public.persona_visible(persona_id)
  and (public.owns_persona(persona_id) or not moderation_private.content_held('comment', id))
  and exists (
    select 1 from public.posts post
    where post.id = post_id
      and public.persona_visible(post.persona_id)
      and (public.owns_persona(post.persona_id)
           or not moderation_private.content_held('post', post.id))
  )
);

alter policy "reactions read" on public.reactions using (
  public.persona_visible(persona_id)
  and exists (
    select 1 from public.posts post
    where post.id = post_id
      and public.persona_visible(post.persona_id)
      and (public.owns_persona(post.persona_id)
           or not moderation_private.content_held('post', post.id))
  )
);

revoke all on function moderation_private.content_held(text,uuid)
  from public, anon, authenticated;
revoke all on function moderation_private.report_content_hidden(text,uuid)
  from public, anon, authenticated;
revoke all on function public.content_visibility_state(text,uuid)
  from public, anon, authenticated;
revoke all on function public.staff_set_content_hold(text,uuid,boolean,text,uuid,text)
  from public, anon;
-- Policies reference the function by OID: callers need EXECUTE, not USAGE.
grant execute on function moderation_private.content_held(text,uuid)
  to anon, authenticated;
grant execute on function public.content_visibility_state(text,uuid)
  to anon, authenticated;
grant execute on function public.staff_set_content_hold(text,uuid,boolean,text,uuid,text)
  to authenticated;

-- @@ADOPTION-EDITS-GO-HERE@@
-- Ledger owner: redefine each function in v_filters below so it skips held
-- posts, and held comments where it returns comments
-- (my_persona_mode_post_panel returns both). Interactions must refuse a held
-- post. Put those `create or replace function` statements here, above the guard.

do $$
declare
  v_filters text[] := array[
    -- reads that return posts or comments to a viewer
    'my_persona_mode_feed',
    'my_persona_mode_profile_posts',
    'my_persona_mode_post_panel',
    -- interactions that must refuse a held post
    'add_persona_comment',
    'persona_mode_add_comment',
    'toggle_persona_reaction',
    'persona_mode_toggle_reaction'
  ];
  -- Reviewed: these act on the caller's own content, or are this slice's own
  -- functions, which handle holds themselves.
  v_reviewed text[] := array[
    'delete_persona_comment',
    'delete_persona_post',
    'persona_mode_delete_comment',
    'persona_publication_review_manifest',
    'persona_publication_review_manifest_legacy_059',
    'reconcile_staged_native_page_publications',
    'save_persona_post',
    'stage_native_agent_draft_for_review',
    'report_content',
    'content_visibility_state',
    'staff_set_content_hold',
    'staff_list_content_reports'
  ];
  v_missing text;
  v_unreviewed text;
  v_views text;
begin
  with callable as (
    select proc.oid, ns.nspname, proc.proname,
           regexp_replace(regexp_replace(proc.prosrc, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g') as code
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname in ('public','moderation_private')
      and proc.prosecdef
      and (pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')
           or pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE'))
  )
  select string_agg(distinct callable.nspname || '.' || callable.proname, ', ') into v_unreviewed
  from callable
  where callable.code ~* 'public\.(posts|comments|reactions)\y'
    and not (callable.nspname = 'public' and callable.proname = any(v_filters || v_reviewed));

  select string_agg(required.name, ', ' order by required.name) into v_missing
  from unnest(v_filters) as required(name)
  where not exists (
    select 1 from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public' and proc.proname = required.name
  )
  or exists (
    select 1 from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = required.name
      and regexp_replace(regexp_replace(proc.prosrc, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g')
          !~ 'moderation_private\.content_held'
  );

  select string_agg(view_class.relname, ', ') into v_views
  from pg_catalog.pg_class view_class
  join pg_catalog.pg_namespace ns on ns.oid = view_class.relnamespace
  where ns.nspname = 'public'
    and view_class.relkind in ('v','m')
    and pg_catalog.pg_get_viewdef(view_class.oid) ~* '\y(posts|comments|reactions)\y'
    and coalesce(array_to_string(view_class.reloptions, ','), '') !~ 'security_invoker=(true|on|1)';

  if v_missing is not null then
    raise exception 'Moderation holds not adopted: these SECURITY DEFINER social RPCs bypass RLS and must filter moderation_private.content_held() in this same migration: %', v_missing;
  end if;
  if v_unreviewed is not null then
    raise exception 'Moderation holds not adopted: unreviewed SECURITY DEFINER functions read posts, comments or reactions: %', v_unreviewed;
  end if;
  if v_views is not null then
    raise exception 'Moderation holds not adopted: owner-rights views read posts, comments or reactions: %', v_views;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
