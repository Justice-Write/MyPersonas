-- Disposable fixture for 20261016180000_content_reports_moderation_queue.sql.
-- persona_visible is the live production body (read 2026-10-16). Only the publication-review
-- internals behind persona_publication_is_current are reduced to publication_state='published'.
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true)) $$;
grant usage on schema auth,public to anon,authenticated,service_role;

create table public.profiles(id uuid primary key);
create table public.personas(id uuid primary key, owner uuid not null references public.profiles(id),
  handle text not null, visibility text not null default 'public', publication_state text not null default 'published');
create table public.posts(id uuid primary key, persona_id uuid not null references public.personas(id));
create table public.comments(id uuid primary key, post_id uuid not null references public.posts(id), persona_id uuid not null references public.personas(id));
create table public.blocks(id uuid primary key default gen_random_uuid(), blocker uuid not null references public.profiles(id),
  blocked_persona uuid not null references public.personas(id), kind text not null check (kind in ('block','mute')),
  unique (blocker, blocked_persona, kind));
create table public.follows(id uuid primary key default gen_random_uuid(), follower uuid, target uuid, status text);
create table public.persona_publication_dependencies(persona_id uuid, dependency_persona_id uuid);
create table public.platform_role_assignments(account_id uuid references public.profiles(id), role_key text, active boolean not null default true,
  expires_at timestamptz, primary key(account_id, role_key));

create function public.persona_publication_is_current(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.personas p where p.id=pid and p.publication_state='published') $$;

create function public.persona_visible(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.personas persona
    where persona.id = pid and (
      persona.owner = auth.uid()
      or (
        public.persona_publication_is_current(persona.id)
        and not exists (
          select 1
          from public.persona_publication_dependencies dependency
          join public.personas relative on relative.id=dependency.dependency_persona_id
          where dependency.persona_id=persona.id and (
            exists (select 1 from public.blocks hidden_dependency
              where hidden_dependency.blocker=auth.uid() and hidden_dependency.blocked_persona=relative.id
                and hidden_dependency.kind in ('block','mute'))
            or exists (select 1 from public.blocks dependency_blocked_viewer
              join public.personas viewer_persona on viewer_persona.id=dependency_blocked_viewer.blocked_persona and viewer_persona.owner=auth.uid()
              where dependency_blocked_viewer.blocker=relative.owner and dependency_blocked_viewer.kind='block')
          )
        )
        and not exists (select 1 from public.blocks hidden
          where hidden.blocker=auth.uid() and hidden.blocked_persona=persona.id and hidden.kind in ('block','mute'))
        and not exists (select 1 from public.blocks blocked
          join public.personas mine on mine.id=blocked.blocked_persona and mine.owner=auth.uid()
          where blocked.blocker=persona.owner and blocked.kind='block')
        and (
          persona.visibility in ('public','unlisted')
          or (persona.visibility = 'private' and exists (
            select 1 from public.follows friendship
            join public.personas mine on (
              (friendship.follower=persona.id and mine.id=friendship.target)
              or (friendship.target=persona.id and mine.id=friendship.follower))
            where friendship.status='accepted' and mine.owner=auth.uid()))
        )
      )
    )
  ) $$;

create function public.has_platform_role(p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (select 1 from public.platform_role_assignments a where a.account_id=auth.uid() and a.active
    and (a.expires_at is null or a.expires_at>now()) and a.role_key=any(coalesce(p_roles,'{}'::text[]))) $$;
create function public.require_aal2() returns void language plpgsql stable set search_path='' as $$
begin
  if auth.uid() is null then raise sqlstate '28000' using message='Authentication required'; end if;
  if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise sqlstate '42501' using message='Two-factor verification required'; end if;
end $$;

-- Accounts: A reporter, B target owner, C third party, S staff (technician), X expired staff.
insert into public.profiles values
 ('a0000000-0000-4000-8000-00000000000a'),('b0000000-0000-4000-8000-00000000000b'),
 ('c0000000-0000-4000-8000-00000000000c'),('5ff00000-0000-4000-8000-000000000005'),('e0000000-0000-4000-8000-00000000000e');
insert into public.personas(id,owner,handle,visibility,publication_state) values
 ('a1000000-0000-4000-8000-0000000000a1','a0000000-0000-4000-8000-00000000000a','alpha','public','published'),
 ('b1000000-0000-4000-8000-0000000000b1','b0000000-0000-4000-8000-00000000000b','bravo','public','published'),
 ('b2000000-0000-4000-8000-0000000000b2','b0000000-0000-4000-8000-00000000000b','bravo_private','private','published'),
 ('b3000000-0000-4000-8000-0000000000b3','b0000000-0000-4000-8000-00000000000b','bravo_draft','public','draft'),
 ('c1000000-0000-4000-8000-0000000000c1','c0000000-0000-4000-8000-00000000000c','charlie','public','published');
insert into public.posts values
 ('b1a00000-0000-4000-8000-00000000b1a0','b1000000-0000-4000-8000-0000000000b1'),
 ('a1a00000-0000-4000-8000-00000000a1a0','a1000000-0000-4000-8000-0000000000a1'),
 ('b2a00000-0000-4000-8000-00000000b2a0','b2000000-0000-4000-8000-0000000000b2');
insert into public.comments values
 ('cc100000-0000-4000-8000-0000000cc100','a1a00000-0000-4000-8000-00000000a1a0','b1000000-0000-4000-8000-0000000000b1'),
 ('cc200000-0000-4000-8000-0000000cc200','b2a00000-0000-4000-8000-00000000b2a0','c1000000-0000-4000-8000-0000000000c1');
insert into public.platform_role_assignments(account_id,role_key,active,expires_at) values
 ('5ff00000-0000-4000-8000-000000000005','technician',true,null),
 ('e0000000-0000-4000-8000-00000000000e','technician',true,now()-interval '1 day');
grant select on public.profiles, public.personas, public.posts, public.comments to anon, authenticated;
