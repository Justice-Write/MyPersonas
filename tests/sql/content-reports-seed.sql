-- Disposable fixture for 080-content-reports-moderation-queue.sql and the
-- 081 holds draft. Run by scripts/test-content-reports-sql.sh as the cluster
-- superuser. Never apply this to a real project.
--
-- Column shapes, policy names, grants and helper signatures match the
-- 2026-10-16 read-only readback of project nwsqyuucwzihruszocge.
-- persona_visible() is the production body verbatim. persona_publication_is_current()
-- is reduced to publication_state = 'published'.
--
-- Everything after role setup is created by db_owner, a non-superuser table
-- owner, the way Supabase's postgres role owns tables and SECURITY DEFINER
-- functions. Later sessions start as db_owner through the database default.

\set ON_ERROR_STOP 1

create extension if not exists pgcrypto;
create extension if not exists dblink;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'db_owner') then create role db_owner nologin nosuperuser; end if;
end;
$$;
grant anon, authenticated, service_role to db_owner;
grant create on database postgres to db_owner;
grant all on schema public to db_owner;
alter database postgres set role = 'db_owner';
set role db_owner;

-- Supabase grants these by default on objects created in public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  prefs jsonb,
  created_at timestamptz default now()
);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  handle text not null unique,
  name text not null,
  tagline text,
  bio text,
  visibility text default 'public',
  publication_state text not null default 'published',
  created_at timestamptz default now(),
  unique (id, owner)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  kind text,
  title text,
  body text,
  tags text,
  media_url text,
  created_at timestamptz default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  kind text not null,
  created_at timestamptz default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker uuid not null,
  blocked_persona uuid not null references public.personas(id) on delete cascade,
  kind text,
  created_at timestamptz default now(),
  unique (blocker, blocked_persona, kind)
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower uuid not null references public.personas(id) on delete cascade,
  target uuid not null references public.personas(id) on delete cascade,
  status text,
  created_at timestamptz default now()
);

create table public.persona_publication_dependencies (
  persona_id uuid not null references public.personas(id) on delete cascade,
  owner uuid not null,
  dependency_persona_id uuid not null,
  dependency_kind text not null default 'linked',
  dependency_revision integer,
  projection_sha256 text,
  created_at timestamptz default now()
);

create table public.platform_role_assignments (
  account_id   uuid not null references public.profiles(id) on delete cascade,
  role_key     text not null check (role_key in ('global_administrator','technician','security_auditor')),
  granted_by   uuid references public.profiles(id) on delete set null,
  reason       text not null default '' check (char_length(reason) <= 1000),
  active       boolean not null default true,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (account_id, role_key)
);

-- Production bodies (MyPersonas ledger 20260822170000, 20260830051925).
create or replace function public.has_platform_role(p_roles text[])
returns boolean language sql security definer stable set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.platform_role_assignments assignment
    where assignment.account_id = auth.uid()
      and assignment.active
      and (assignment.expires_at is null or assignment.expires_at > now())
      and assignment.role_key = any(coalesce(p_roles, '{}'::text[]))
  )
$$;
revoke all on function public.has_platform_role(text[]) from public, anon;
grant execute on function public.has_platform_role(text[]) to authenticated;

create or replace function public.require_aal2()
returns void language plpgsql stable security invoker set search_path = '' as $function$
begin
  if auth.uid() is null then
    raise sqlstate '28000' using message = 'Authentication required';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise sqlstate '42501' using message = 'Two-factor verification required';
  end if;
end;
$function$;
revoke all on function public.require_aal2() from public, anon, authenticated, service_role;

-- Simplified stand-ins.
create or replace function public.persona_publication_is_current(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.personas persona
    where persona.id = pid and persona.publication_state = 'published'
  )
$$;
revoke all on function public.persona_publication_is_current(uuid) from public, anon, authenticated;

create or replace function public.owns_persona(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.personas persona
    where persona.id = pid and persona.owner = auth.uid()
  )
$$;

-- Production body, verbatim from pg_get_functiondef on 2026-10-16.
create or replace function public.persona_visible(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.personas persona
    where persona.id = pid and (
      persona.owner = auth.uid()
      or (
        public.persona_publication_is_current(persona.id)
        and not exists (
          select 1
          from public.persona_publication_dependencies dependency
          join public.personas relative
            on relative.id=dependency.dependency_persona_id
          where dependency.persona_id=persona.id and (
            exists (
              select 1 from public.blocks hidden_dependency
              where hidden_dependency.blocker=auth.uid()
                and hidden_dependency.blocked_persona=relative.id
                and hidden_dependency.kind in ('block','mute')
            )
            or exists (
              select 1 from public.blocks dependency_blocked_viewer
              join public.personas viewer_persona
                on viewer_persona.id=dependency_blocked_viewer.blocked_persona
               and viewer_persona.owner=auth.uid()
              where dependency_blocked_viewer.blocker=relative.owner
                and dependency_blocked_viewer.kind='block'
            )
          )
        )
        and not exists (
          select 1 from public.blocks hidden
          where hidden.blocker=auth.uid() and hidden.blocked_persona=persona.id
            and hidden.kind in ('block','mute')
        )
        and not exists (
          select 1 from public.blocks blocked
          join public.personas mine on mine.id=blocked.blocked_persona and mine.owner=auth.uid()
          where blocked.blocker=persona.owner and blocked.kind='block'
        )
        and (
          persona.visibility in ('public','unlisted')
          or (persona.visibility = 'private' and exists (
            select 1 from public.follows friendship
            join public.personas mine on (
              (friendship.follower=persona.id and mine.id=friendship.target)
              or (friendship.target=persona.id and mine.id=friendship.follower)
            )
            where friendship.status='accepted' and mine.owner=auth.uid()
          ))
        )
      )
    )
  )
$function$;
revoke all on function public.owns_persona(uuid) from public, anon, authenticated;
revoke all on function public.persona_visible(uuid) from public, anon, authenticated;
grant execute on function public.owns_persona(uuid) to anon, authenticated;
grant execute on function public.persona_visible(uuid) to anon, authenticated;

-- Production RLS read policies (names and predicates from pg_policies).
alter table public.personas enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.blocks enable row level security;
create policy "personas visible read" on public.personas for select using ((owner = auth.uid()) or public.persona_visible(id));
create policy "posts visible read" on public.posts for select using (public.persona_visible(persona_id));
create policy "posts owner write" on public.posts for all using (public.owns_persona(persona_id));
create policy "comments read" on public.comments for select using (
  public.persona_visible(persona_id)
  and exists (select 1 from public.posts post where post.id = post_id and public.persona_visible(post.persona_id))
);
create policy "reactions read" on public.reactions for select using (
  public.persona_visible(persona_id)
  and exists (select 1 from public.posts post where post.id = post_id and public.persona_visible(post.persona_id))
);
create policy "blocks owner only" on public.blocks for all using (auth.uid() = blocker);
revoke insert, update, delete on public.blocks, public.posts, public.comments, public.reactions from anon, authenticated;

-- Stand-ins for the production SECURITY DEFINER social RPCs, as they are today:
-- they read posts directly and know nothing about moderation holds.
create or replace function public.my_persona_mode_feed(
  p_actor_persona_id uuid, p_before_created_at timestamptz, p_before_id uuid, p_limit integer
) returns setof public.posts language plpgsql stable security definer set search_path = '' as $$
begin
  return query select post.* from public.posts post
  where public.persona_visible(post.persona_id)
  order by post.created_at desc limit coalesce(p_limit, 20);
end;
$$;
create or replace function public.my_persona_mode_profile_posts(
  p_actor_persona_id uuid, p_target_persona_id uuid, p_before_created_at timestamptz,
  p_before_id uuid, p_kind text, p_search text, p_limit integer
) returns setof public.posts language plpgsql stable security definer set search_path = '' as $$
begin
  return query select post.* from public.posts post
  where post.persona_id = p_target_persona_id and public.persona_visible(post.persona_id)
  order by post.created_at desc limit coalesce(p_limit, 20);
end;
$$;
create or replace function public.my_persona_mode_post_panel(p_actor_persona_id uuid, p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return (select to_jsonb(post) from public.posts post where post.id = p_post_id);
end;
$$;
create or replace function public.add_persona_comment(p_post_id uuid, p_persona_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.comments(post_id, persona_id, body) values (p_post_id, p_persona_id, p_body) returning id into v_id;
  return v_id;
end;
$$;
create or replace function public.persona_mode_add_comment(p_actor_persona_id uuid, p_post_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return public.add_persona_comment(p_post_id, p_actor_persona_id, p_body);
end;
$$;
create or replace function public.toggle_persona_reaction(p_post_id uuid, p_persona_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reactions(post_id, persona_id, kind) values (p_post_id, p_persona_id, p_kind);
  return jsonb_build_object('removed', false);
end;
$$;
create or replace function public.persona_mode_toggle_reaction(p_actor_persona_id uuid, p_post_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.toggle_persona_reaction(p_post_id, p_actor_persona_id, p_kind);
end;
$$;

-- Test helpers.
create or replace function public.test_as(p_uid uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{}', false);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'aal', p_aal, 'role', 'authenticated')::text, false);
  end if;
end;
$$;
create or replace function public.test_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end;
$$;
create or replace function public.test_expect_error(p_sql text, p_pattern text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~* p_pattern then
      raise exception 'ASSERTION FAILED: expected /%/ from [%], got: %', p_pattern, p_sql, sqlerrm;
    end if;
    return;
  end;
  raise exception 'ASSERTION FAILED: expected /%/ but [%] succeeded', p_pattern, p_sql;
end;
$$;
grant execute on function public.test_as(uuid, text), public.test_assert(boolean, text),
  public.test_expect_error(text, text) to anon, authenticated;
