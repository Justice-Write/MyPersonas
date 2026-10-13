create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true)) $$;
grant usage on schema auth,public,storage to anon,authenticated,service_role;
create table public.personas(id uuid primary key,owner uuid not null references auth.users(id));
grant select on public.personas to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
-- Deliberately unsafe preexisting policy: the new restrictive fence must win.
create policy old_generic_storage on storage.objects for all to public using(true) with check(true);
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.personas values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
