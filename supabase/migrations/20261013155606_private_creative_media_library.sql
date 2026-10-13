-- Local candidate only. Reconcile linked history before an approved release.
begin;
create table if not exists public.owner_media_library (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references auth.users(id) on delete cascade,
 persona_id uuid references public.personas(id) on delete set null,
 parent_id uuid,
 unique(owner,id),
 foreign key(owner,parent_id) references public.owner_media_library(owner,id) on delete set null(parent_id),
 title text not null check (length(btrim(title)) between 1 and 200),
 project text not null default '' check (length(project)<=120),
 alt_text text not null default '' check (length(alt_text)<=2000),
 notes text not null default '' check (length(notes)<=4000),
 source_tool text not null check (source_tool in ('upload','soul_concept','davinci','foxy','higgsfield','freebeat','openart','other')),
 kind text not null check (kind in ('image','video','audio')),
 storage_path text,
 source_url text,
 mime text,
 byte_size bigint,
 sha256 text,
 rights_confirmed boolean not null check (rights_confirmed),
 training_allowed boolean not null default false check (training_allowed=false),
 review_status text not null default 'unreviewed' check (review_status='unreviewed'),
 created_at timestamptz not null default now(),
 constraint owner_media_location check (
  (storage_path = owner::text||'/'||id::text and source_url is null and byte_size between 1 and 52428800
   and mime in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4')
   and split_part(mime,'/',1)=kind and sha256 ~ '^[a-f0-9]{64}$')
  or (storage_path is null and source_tool='openart' and source_url ~ '^https://cdn[.]openart[.]ai/[^[:space:]]+$'
   and sha256 is null and byte_size is null and mime is null)
 ),
 constraint owner_media_location_required check (
  (storage_path is not null and sha256 is not null and byte_size is not null and mime is not null and source_url is null)
  or (source_url is not null and storage_path is null and source_tool='openart')
 )
);
create index if not exists owner_media_recent on public.owner_media_library(owner,created_at desc);
create unique index if not exists owner_media_dedupe on public.owner_media_library(owner,sha256) where sha256 is not null;
alter table public.owner_media_library enable row level security;
revoke all on public.owner_media_library from public, anon, authenticated;
grant select,insert,delete on public.owner_media_library to authenticated;
grant update(title,project,alt_text,notes,persona_id) on public.owner_media_library to authenticated;
grant all on public.owner_media_library to service_role;
drop policy if exists owner_media_read on public.owner_media_library;
create policy owner_media_read on public.owner_media_library for select to authenticated
 using(owner=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
drop policy if exists owner_media_insert on public.owner_media_library;
create policy owner_media_insert on public.owner_media_library for insert to authenticated with check (
 owner=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2'
 and (persona_id is null or exists(select 1 from public.personas p where p.id=owner_media_library.persona_id and p.owner=(select auth.uid())))
);
drop policy if exists owner_media_update on public.owner_media_library;
create policy owner_media_update on public.owner_media_library for update to authenticated
 using(owner=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
 with check(owner=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2'
 and (persona_id is null or exists(select 1 from public.personas p where p.id=owner_media_library.persona_id and p.owner=(select auth.uid()))));
drop policy if exists owner_media_delete on public.owner_media_library;
create policy owner_media_delete on public.owner_media_library for delete to authenticated
 using(owner=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('creative-private','creative-private',false,52428800,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive fence also applies when older permissive storage policies exist.
drop policy if exists creative_private_fence on storage.objects;
create policy creative_private_fence on storage.objects as restrictive for all to public
 using(bucket_id<>'creative-private' or ((select auth.jwt()->>'aal')='aal2' and split_part(name,'/',1)=(select auth.uid())::text))
 with check(bucket_id<>'creative-private' or ((select auth.jwt()->>'aal')='aal2' and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'));
drop policy if exists creative_private_read on storage.objects;
create policy creative_private_read on storage.objects for select to authenticated using(bucket_id='creative-private' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists creative_private_insert on storage.objects;
create policy creative_private_insert on storage.objects for insert to authenticated with check(bucket_id='creative-private' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists creative_private_delete on storage.objects;
create policy creative_private_delete on storage.objects for delete to authenticated using(bucket_id='creative-private' and split_part(name,'/',1)=(select auth.uid())::text);
-- Block object replacement even if an older generic update policy would allow it.
drop policy if exists creative_private_no_replace on storage.objects;
create policy creative_private_no_replace on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'creative-private') with check(bucket_id<>'creative-private');
comment on table public.owner_media_library is 'Owner-private creative references. Unreviewed, no training permission, no provider send or publication grant.';
commit;
