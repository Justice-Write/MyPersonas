-- Simulates the adoption edits for 081-content-moderation-holds.DRAFT.sql.
-- scripts/test-content-reports-sql.sh inserts this file at the
-- @@ADOPTION-EDITS-GO-HERE@@ marker. Real adoption
-- edits the production bodies of these functions in the same way: viewer reads
-- skip held posts and held comments, and interactions refuse a held post.
create or replace function public.my_persona_mode_feed(
  p_actor_persona_id uuid, p_before_created_at timestamptz, p_before_id uuid, p_limit integer
) returns setof public.posts language plpgsql stable security definer set search_path = '' as $$
begin
  return query select post.* from public.posts post
  where public.persona_visible(post.persona_id)
    and (public.owns_persona(post.persona_id) or not moderation_private.content_held('post', post.id))
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
    and (public.owns_persona(post.persona_id) or not moderation_private.content_held('post', post.id))
  order by post.created_at desc limit coalesce(p_limit, 20);
end;
$$;
create or replace function public.my_persona_mode_post_panel(p_actor_persona_id uuid, p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return (
    select jsonb_build_object(
      'post', to_jsonb(post),
      'comments', coalesce((
        select jsonb_agg(item order by item.created_at)
        from public.comments item
        where item.post_id = post.id
          and public.persona_visible(item.persona_id)
          and (public.owns_persona(item.persona_id)
               or not moderation_private.content_held('comment', item.id))
      ), '[]'::jsonb)
    )
    from public.posts post
    where post.id = p_post_id
      and public.persona_visible(post.persona_id)
      and (public.owns_persona(post.persona_id) or not moderation_private.content_held('post', post.id))
  );
end;
$$;
create or replace function public.add_persona_comment(p_post_id uuid, p_persona_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if moderation_private.content_held('post', p_post_id) then raise exception 'Post not found'; end if;
  insert into public.comments(post_id, persona_id, body) values (p_post_id, p_persona_id, p_body) returning id into v_id;
  return v_id;
end;
$$;
create or replace function public.persona_mode_add_comment(p_actor_persona_id uuid, p_post_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if moderation_private.content_held('post', p_post_id) then raise exception 'Post not found'; end if;
  return public.add_persona_comment(p_post_id, p_actor_persona_id, p_body);
end;
$$;
create or replace function public.toggle_persona_reaction(p_post_id uuid, p_persona_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if moderation_private.content_held('post', p_post_id) then raise exception 'Post not found'; end if;
  insert into public.reactions(post_id, persona_id, kind) values (p_post_id, p_persona_id, p_kind);
  return jsonb_build_object('removed', false);
end;
$$;
create or replace function public.persona_mode_toggle_reaction(p_actor_persona_id uuid, p_post_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if moderation_private.content_held('post', p_post_id) then raise exception 'Post not found'; end if;
  return public.toggle_persona_reaction(p_post_id, p_actor_persona_id, p_kind);
end;
$$;
