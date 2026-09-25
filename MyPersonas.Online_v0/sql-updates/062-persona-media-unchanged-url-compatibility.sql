-- Compatibility bridge for profiles whose first-party media predates the
-- provenance registry. A non-media profile update must not reinterpret an
-- unchanged URL under today's intake rules. New references still fail closed.

begin;

create or replace function public.bind_persona_media_asset_references()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.avatar_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.avatar_url);
    new.banner_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.banner_url);
    new.bg_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.bg_url);
    new.feed_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.feed_img_url);
    return new;
  end if;

  if new.avatar_url is not distinct from old.avatar_url then
    new.avatar_media_asset_id:=old.avatar_media_asset_id;
  else
    new.avatar_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.avatar_url);
  end if;
  if new.banner_url is not distinct from old.banner_url then
    new.banner_media_asset_id:=old.banner_media_asset_id;
  else
    new.banner_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.banner_url);
  end if;
  if new.bg_url is not distinct from old.bg_url then
    new.bg_media_asset_id:=old.bg_media_asset_id;
  else
    new.bg_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.bg_url);
  end if;
  if new.feed_img_url is not distinct from old.feed_img_url then
    new.feed_media_asset_id:=old.feed_media_asset_id;
  else
    new.feed_media_asset_id:=public.resolve_persona_media_asset_reference(new.id,new.feed_img_url);
  end if;
  return new;
end;
$$;
revoke all on function public.bind_persona_media_asset_references()
  from public,anon,authenticated;

comment on function public.bind_persona_media_asset_references() is
  'Preserves the existing media-asset binding when an UPDATE leaves that slot URL unchanged; INSERTs and changed URLs must resolve through the canonical provenance registry.';

commit;
