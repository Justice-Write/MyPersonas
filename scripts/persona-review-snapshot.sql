-- Read-only, owner-internal snapshot. Save the result under ignored outputs/ only.
-- Intentionally excludes account login emails, owner IDs, notes, prompts, and credentials.
-- An administrator read is not an unrelated-account RLS test or publication approval.
select jsonb_build_object(
  'schema_version',1,'captured_at',clock_timestamp(),'source','authenticated_read_only_database',
  'personas',coalesce(jsonb_agg(packet order by packet->'profile'->>'handle'),'[]'::jsonb)
) as snapshot
from (
 select jsonb_build_object(
  'profile',jsonb_build_object('id',p.id,'handle',p.handle,'name',p.name,'title',p.title,
    'tagline',p.tagline,'bio',p.bio,'focus',p.focus,'topics',p.topics,'hashtags',p.hashtags,
    'pet_project',p.pet_project,'nsfw',p.nsfw,'visibility',p.visibility,
    'publication_state',p.publication_state,'publication_revision',p.publication_revision,
    'published_revision',p.published_revision,'ai_disclosure',p.ai_disclosure,
    'avatar_url',p.avatar_url,'banner_url',p.banner_url,'bg_url',p.bg_url,'feed_img_url',p.feed_img_url,
    'music_url',p.music_url,'live_url',p.live_url,'theme',p.theme,'top8',p.top8,'linked',p.linked,'modules',p.modules),
  'destination_links',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from
    (select id,platform,handle,url,sort from public.persona_links where persona_id=p.id) v),'[]'::jsonb),
  'account_bindings',coalesce((select jsonb_agg(to_jsonb(v) order by v.ledger_id) from
    (select l.id as ledger_id,l.provider,l.username,l.url,l.suspended,c.connection_state,c.granted_scopes,
      c.verification_method,c.verified_at,c.last_checked_at,c.expires_at
     from public.account_ledger l left join public.account_connections c on c.ledger_id=l.id and c.owner=l.owner
     where l.persona_id=p.id and l.owner=p.owner) v),'[]'::jsonb),
  'media_assets',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from
    (select id,public_url,media_type,alt_text,status,origin,ai_use,declaration_source,generated_on_site,
      source_sha256,content_sha256,mime_type,byte_size,watermark_state,watermark_version,
      watermark_asset_sha256,provenance_sha256,rendition from public.persona_media_assets
      where persona_id=p.id and owner=p.owner) v),'[]'::jsonb),
  'layout',coalesce((select jsonb_build_object('schema_version',schema_version,'layout',layout)
     from public.persona_page_layouts where persona_id=p.id and owner=p.owner),'{}'::jsonb),
  'posts',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from
    (select id,kind,title,body,tags,media_url,media_asset_id from public.posts where persona_id=p.id) v),'[]'::jsonb),
  'albums',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from
    (select a.id,a.title,a.kind,a.sort,coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from
      (select id,thumb_url,caption,link_url,sort,media_asset_id from public.album_items where album_id=a.id) i),'[]'::jsonb) as items
     from public.albums a where a.persona_id=p.id) v),'[]'::jsonb),
  'family',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from
    (select f.id,f.relationship_type,a.handle as from_handle,b.handle as to_handle,f.visibility,f.canon_status
     from public.persona_family_relationships f join public.personas a on a.id=f.from_persona_id
     join public.personas b on b.id=f.to_persona_id where f.owner=p.owner and p.id in(f.from_persona_id,f.to_persona_id)) v),'[]'::jsonb),
  'dependencies',coalesce((select jsonb_agg(to_jsonb(v) order by v.dependency_kind,v.handle) from
    (select d.dependency_kind,q.handle,q.publication_state,q.publication_revision,d.dependency_revision,d.projection_sha256
     from public.persona_publication_dependencies d join public.personas q on q.id=d.dependency_persona_id
     where d.persona_id=p.id and d.owner=p.owner) v),'[]'::jsonb),
  'businesses',coalesce((select jsonb_agg(to_jsonb(v) order by v.slug) from
    (select b.slug,b.display_name,b.short_bio,b.mission,b.page_status,b.visibility,b.publication_revision,
      m.membership_role,m.public_title,m.enabled,m.membership_visibility,m.title_visibility
     from public.business_persona_memberships m join public.businesses b on b.id=m.business_id
     where m.persona_id=p.id and m.owner=p.owner) v),'[]'::jsonb),
  'revenue',coalesce((select jsonb_build_object('affiliate_enabled',affiliate_enabled,'review_requests_enabled',review_requests_enabled,
      'default_disclosure',default_disclosure,'cta_label',cta_label,'review_cta_label',review_cta_label)
      from public.persona_revenue_settings where persona_id=p.id and owner=p.owner),'{}'::jsonb),
  'request_review',coalesce((select jsonb_build_object('enabled',enabled,'destination_configured',destination_ledger_id is not null)
      from public.product_review_settings where persona_id=p.id and owner=p.owner),'{}'::jsonb),
  'automation_safety',jsonb_build_object('purpose_present',coalesce(p.purpose,'')<>'','voice_present',coalesce(p.voice,'')<>'',
      'audience_present',coalesce(p.audience,'')<>'','rules_present',coalesce(p.dont,'')<>'','backend_configured',p.ai_backend is not null,
      'private_config_sha256',encode(extensions.digest(convert_to(jsonb_build_array(p.purpose,p.voice,p.audience,p.dont,p.ai_backend)::text,'UTF8'),'sha256'),'hex'))
 ) as packet from public.personas p where p.visibility='public'
) packets;
