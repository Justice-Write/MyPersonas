\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub','05900000-0000-4000-8000-000000000099',false);
select set_config('request.jwt.claim.role','service_role',false);

do $$
declare
  v_asset_id uuid;
  v_bound_asset_id uuid;
  v_insert_denied boolean:=false;
  v_changed_url_denied boolean:=false;
  v_hash text:=repeat('6',64);
  v_path text;
  v_url text;
begin
  -- This row and all four of its legacy first-party URLs existed before the
  -- provenance trigger. A layout/publication revision update must not attempt
  -- to reinterpret those unchanged references.
  update public.personas
  set publication_revision=publication_revision+1
  where id='05900000-0000-4000-8000-000000000198';

  if not exists(
    select 1 from public.personas
    where id='05900000-0000-4000-8000-000000000198'
      and publication_revision=2
      and avatar_media_asset_id is null
      and banner_media_asset_id is null
      and bg_media_asset_id is null
      and feed_media_asset_id is null
      and avatar_url like '%/legacy/profile/avatar.png'
      and banner_url like '%/legacy/profile/banner.png'
      and bg_url like '%/legacy/profile/background.png'
      and feed_img_url like '%/legacy/profile/feed.png'
  ) then
    raise exception 'Unchanged pre-provenance profile media did not survive a non-media update';
  end if;

  -- An INSERT has no prior reference to preserve and must still use the strict
  -- resolver. The same legacy first-party URL is therefore rejected.
  begin
    insert into public.personas(id,owner,handle,avatar_url) values (
      '05900000-0000-4000-8000-000000000197',
      '05900000-0000-4000-8000-000000000099','new-legacy-first-party-profile',
      'https://project.test/storage/v1/object/public/persona-media/05900000-0000-4000-8000-000000000099/legacy/profile/new-avatar.png'
    );
  exception when others then
    v_insert_denied:=true;
  end;
  if not v_insert_denied or exists(
    select 1 from public.personas
    where id='05900000-0000-4000-8000-000000000197'
  ) then
    raise exception 'An INSERT bypassed strict persona media resolution';
  end if;

  -- A changed first-party URL must still be resolved and rejected when it has
  -- no active canonical provenance record.
  begin
    update public.personas
    set avatar_url='https://project.test/storage/v1/object/public/persona-media/05900000-0000-4000-8000-000000000099/legacy/profile/changed-avatar.png'
    where id='05900000-0000-4000-8000-000000000198';
  exception when others then
    v_changed_url_denied:=true;
  end;
  if not v_changed_url_denied or not exists(
    select 1 from public.personas
    where id='05900000-0000-4000-8000-000000000198'
      and avatar_url like '%/legacy/profile/avatar.png'
  ) then
    raise exception 'A changed unregistered first-party URL did not fail closed';
  end if;

  -- A changed URL with a valid active registry record remains accepted and is
  -- bound. A later attempt to alter only the binding is ignored because the
  -- unchanged URL preserves the previously resolved binding.
  v_path:='05900000-0000-4000-8000-000000000099/published/provenance/none/uploaded/05900000-0000-4000-8000-000000000198/profile/avatar/'||v_hash||'.png';
  v_url:='https://project.test/storage/v1/object/public/persona-media/'||v_path;
  v_asset_id:=public.register_persona_media_asset_service(
    '05900000-0000-4000-8000-000000000099',
    '05900000-0000-4000-8000-000000000198',
    'image',v_path,v_url,'image/png',1234,'uploaded','none',v_hash,v_hash,
    'not_required','','',null,'avatar_url'
  );

  update public.personas set avatar_url=v_url
  where id='05900000-0000-4000-8000-000000000198';
  select avatar_media_asset_id into v_bound_asset_id
  from public.personas
  where id='05900000-0000-4000-8000-000000000198';
  if v_bound_asset_id is distinct from v_asset_id then
    raise exception 'A changed canonical URL was not resolved to its active asset';
  end if;

  update public.personas
  set avatar_media_asset_id=null,publication_revision=publication_revision+1
  where id='05900000-0000-4000-8000-000000000198';
  if not exists(
    select 1 from public.personas
    where id='05900000-0000-4000-8000-000000000198'
      and avatar_media_asset_id=v_asset_id
  ) then
    raise exception 'An unchanged URL did not preserve its existing asset binding';
  end if;
end
$$;
