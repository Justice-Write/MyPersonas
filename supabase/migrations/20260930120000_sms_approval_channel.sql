-- 080 — SMS approval channel
--
-- Adds an opt-in SMS channel to the owner approval queue. When an agent board
-- request or a four-channel content package reaches owner_review, an enrolled
-- owner receives a text carrying a short single-use decision code. Replies of
-- the form "APPROVE A7K2", "REJECT A7K2 <reason>", or "EDIT A7K2 <note>" are
-- applied by the sms-approvals Edge Function through the *_service RPCs below.
-- Free-form replies ("what is Avi's posting cadence?") are answered by the AI
-- backend the owner assigned to SMS handling, using read-only context RPCs.
--
-- Assurance model (deliberate, documented in SMS-APPROVAL-CHANNEL.md):
--   * Enrollment and every settings change happen from an AAL2 web session
--     (require_aal2), and the phone is proven by a one-time code sent to it.
--   * Each decision code is bound to one owner, one subject, one review hash,
--     and one expiry. A text from a different number, or with a stale or used
--     code, does nothing.
--   * SMS never publishes. Agent board approval and content package approval
--     are the same pre-execution decisions the app makes; scheduling, provider
--     publishing, and preview receipts stay behind the AAL2 app flows.
--   * All tables are service-role only. Owners read their channel through
--     my_sms_channel(); nothing else is exposed to the Data API.

begin;

-- ----------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------
create table if not exists public.owner_sms_channels (
  owner                    uuid primary key references public.profiles(id) on delete cascade,
  phone_e164               text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status                   text not null default 'pending_verification'
                           check (status in ('pending_verification','active','paused','revoked')),
  backend_id               uuid references public.ai_backends(id) on delete set null,
  notify_types             text[] not null default array['content_review','agent_board_review']::text[],
  assistant_enabled        boolean not null default true,
  daily_inbound_limit      int not null default 200 check (daily_inbound_limit between 1 and 2000),
  daily_assistant_limit    int not null default 60 check (daily_assistant_limit between 0 and 500),
  verification_code_hash   text not null default '',
  verification_expires_at  timestamptz,
  verification_attempts    int not null default 0,
  consent_version          text not null default '',
  consented_at             timestamptz,
  last_inbound_at          timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- One phone number belongs to at most one active or pending owner.
create unique index if not exists owner_sms_channels_phone_uidx
  on public.owner_sms_channels(phone_e164)
  where status in ('pending_verification','active','paused');

create table if not exists public.sms_approval_tokens (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references public.profiles(id) on delete cascade,
  -- Always at least one digit so an English word ("THAT") can never read as a code.
  code          text not null check (code ~ '^[A-HJ-NP-Z2-9]{4}$' and code ~ '[2-9]'),
  subject_type  text not null check (subject_type in ('agent_board_request','content_package')),
  subject_id    uuid not null,
  persona_id    uuid,
  review_hash   text not null default '',
  status        text not null default 'open'
                check (status in ('open','used','expired','superseded')),
  decision      text not null default '' check (decision in ('','approved','rejected','edit_requested')),
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  expires_at    timestamptz not null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists sms_approval_tokens_open_code_uidx
  on public.sms_approval_tokens(owner, code) where status = 'open';
create unique index if not exists sms_approval_tokens_open_subject_uidx
  on public.sms_approval_tokens(owner, subject_type, subject_id) where status = 'open';
create index if not exists sms_approval_tokens_owner_idx
  on public.sms_approval_tokens(owner, status, created_at desc);

create table if not exists public.sms_messages (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references public.profiles(id) on delete cascade,
  phone_e164     text not null,
  direction      text not null check (direction in ('inbound','outbound')),
  kind           text not null default 'notice'
                 check (kind in ('verification','notice','decision_receipt','assistant','command','system')),
  body           text not null check (char_length(body) between 1 and 1600),
  status         text not null default 'queued'
                 check (status in ('queued','sending','sent','delivered','failed','received','ignored')),
  provider_sid   text not null default '' check (char_length(provider_sid) <= 64),
  error          text not null default '' check (char_length(error) <= 500),
  token_id       uuid references public.sms_approval_tokens(id) on delete set null,
  attempts       int not null default 0,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

create index if not exists sms_messages_outbound_queue_idx
  on public.sms_messages(status, created_at) where direction = 'outbound' and status in ('queued','failed');
create index if not exists sms_messages_owner_idx
  on public.sms_messages(owner, created_at desc);
create unique index if not exists sms_messages_provider_sid_uidx
  on public.sms_messages(provider_sid) where provider_sid <> '';

create table if not exists public.sms_edit_requests (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references public.profiles(id) on delete cascade,
  persona_id    uuid,
  subject_type  text not null check (subject_type in ('agent_board_request','content_package')),
  subject_id    uuid not null,
  note          text not null check (char_length(note) between 1 and 1000),
  status        text not null default 'open' check (status in ('open','addressed','dismissed')),
  created_at    timestamptz not null default now(),
  addressed_at  timestamptz
);

create index if not exists sms_edit_requests_owner_idx
  on public.sms_edit_requests(owner, status, created_at desc);

-- No Data API surface. Owners see their channel through my_sms_channel() and
-- their open edit requests through my_sms_edit_requests().
alter table public.owner_sms_channels enable row level security;
alter table public.sms_approval_tokens enable row level security;
alter table public.sms_messages enable row level security;
alter table public.sms_edit_requests enable row level security;
revoke all on public.owner_sms_channels, public.sms_approval_tokens,
  public.sms_messages, public.sms_edit_requests
  from public, anon, authenticated;
grant select, insert, update, delete on public.owner_sms_channels,
  public.sms_approval_tokens, public.sms_messages, public.sms_edit_requests
  to service_role;

-- ----------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------
create or replace function public.sms_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists owner_sms_channels_touch on public.owner_sms_channels;
create trigger owner_sms_channels_touch before update on public.owner_sms_channels
  for each row execute function public.sms_touch_updated_at();

-- Unambiguous 4-character code: no 0/O, 1/I, at least one digit. ~700k
-- combinations per owner, open codes are unique per owner, and codes expire.
create or replace function public.sms_new_decision_code(p_owner uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int; v_j int;
begin
  for v_i in 1..25 loop
    v_code := '';
    for v_j in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    if v_code ~ '[2-9]' and not exists (
      select 1 from public.sms_approval_tokens
      where owner = p_owner and code = v_code and status = 'open'
    ) then
      return v_code;
    end if;
  end loop;
  raise exception 'Could not allocate an SMS decision code';
end;
$$;

-- Issue (or re-issue) the open token for a subject and queue the text.
create or replace function public.sms_issue_token_service(
  p_owner uuid, p_subject_type text, p_subject_id uuid, p_persona_id uuid,
  p_review_hash text, p_title text, p_summary text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_channel public.owner_sms_channels%rowtype;
  v_code text;
  v_token_id uuid;
  v_notify text := case p_subject_type
    when 'agent_board_request' then 'agent_board_review'
    when 'content_package' then 'content_review' end;
  v_body text;
begin
  select * into v_channel from public.owner_sms_channels
  where owner = p_owner and status = 'active';
  if not found then return null; end if;
  if not (v_notify = any(v_channel.notify_types)) then return null; end if;

  update public.sms_approval_tokens set status = 'superseded'
  where owner = p_owner and subject_type = p_subject_type
    and subject_id = p_subject_id and status = 'open';

  v_code := public.sms_new_decision_code(p_owner);
  insert into public.sms_approval_tokens (
    owner, code, subject_type, subject_id, persona_id, review_hash, expires_at
  ) values (
    p_owner, v_code, p_subject_type, p_subject_id, p_persona_id,
    coalesce(p_review_hash, ''), now() + interval '72 hours'
  ) returning id into v_token_id;

  v_body := left(coalesce(p_title, 'Approval needed'), 120)
    || case when coalesce(p_summary, '') <> '' then E'\n' || left(p_summary, 700) else '' end
    || E'\n\nReply APPROVE ' || v_code || ', REJECT ' || v_code || ' <reason>, or EDIT '
    || v_code || ' <what to change>. Code expires in 72h.';

  insert into public.sms_messages (owner, phone_e164, direction, kind, body, token_id)
  values (p_owner, v_channel.phone_e164, 'outbound', 'notice', v_body, v_token_id);
  return v_token_id;
end;
$$;

-- ----------------------------------------------------------------------
-- Enqueue on owner_review transitions
-- ----------------------------------------------------------------------
create or replace function public.sms_notify_agent_board_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_hash text;
  v_persona_name text;
begin
  if new.status = 'owner_review'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and exists (select 1 from public.owner_sms_channels where owner = new.owner and status = 'active')
  then
    v_payload := public.agent_board_review_payload(new.id, new.owner);
    v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
    select name into v_persona_name from public.personas where id = new.target_persona_id;
    perform public.sms_issue_token_service(
      new.owner, 'agent_board_request', new.id, new.target_persona_id, v_hash,
      'Agent task for ' || coalesce(v_persona_name, 'persona') || ' (' || new.task_type
        || ', ' || new.risk_level || ' risk)',
      left(new.instructions, 700)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sms_notify_agent_board_review on public.agent_board_requests;
create trigger sms_notify_agent_board_review
after insert or update of status on public.agent_board_requests
for each row execute function public.sms_notify_agent_board_review();

create or replace function public.sms_notify_content_package_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_persona_name text;
  v_preview text;
begin
  if new.status = 'owner_review'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and exists (select 1 from public.owner_sms_channels where owner = new.owner and status = 'active')
  then
    select name into v_persona_name from public.personas where id = new.persona_id;
    select left(body, 400) into v_preview from public.persona_content_variants
    where package_id = new.id and owner = new.owner and channel = 'x' limit 1;
    perform public.sms_issue_token_service(
      new.owner, 'content_package', new.id, new.persona_id, '',
      'Content kit for ' || coalesce(v_persona_name, 'persona') || ': ' || coalesce(nullif(new.title, ''), 'untitled'),
      coalesce(v_preview, '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sms_notify_content_package_review on public.persona_content_packages;
create trigger sms_notify_content_package_review
after insert or update of status on public.persona_content_packages
for each row execute function public.sms_notify_content_package_review();

-- Close tokens whose subject was decided elsewhere (app, another channel).
create or replace function public.sms_close_tokens_on_subject_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  v_type := case tg_table_name
    when 'agent_board_requests' then 'agent_board_request'
    when 'persona_content_packages' then 'content_package' end;
  if new.status <> 'owner_review' and old.status = 'owner_review' then
    update public.sms_approval_tokens set status = 'superseded'
    where owner = new.owner and subject_type = v_type and subject_id = new.id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists sms_close_tokens_agent_board on public.agent_board_requests;
create trigger sms_close_tokens_agent_board
after update of status on public.agent_board_requests
for each row execute function public.sms_close_tokens_on_subject_change();
drop trigger if exists sms_close_tokens_content_package on public.persona_content_packages;
create trigger sms_close_tokens_content_package
after update of status on public.persona_content_packages
for each row execute function public.sms_close_tokens_on_subject_change();

-- ----------------------------------------------------------------------
-- Owner-facing (AAL2) RPCs — enrollment and settings
-- ----------------------------------------------------------------------
create or replace function public.my_sms_channel()
returns table (
  phone_e164 text, status text, backend_id uuid, backend_name text,
  notify_types text[], assistant_enabled boolean, consented_at timestamptz,
  last_inbound_at timestamptz, open_codes int
)
language sql security definer stable set search_path = '' as $$
  select c.phone_e164, c.status, c.backend_id, b.name, c.notify_types,
         c.assistant_enabled, c.consented_at, c.last_inbound_at,
         (select count(*)::int from public.sms_approval_tokens t
          where t.owner = c.owner and t.status = 'open' and t.expires_at > now())
  from public.owner_sms_channels c
  left join public.ai_backends b on b.id = c.backend_id and b.owner = c.owner
  where c.owner = auth.uid();
$$;

create or replace function public.my_sms_edit_requests()
returns setof public.sms_edit_requests
language sql security definer stable set search_path = '' as $$
  select * from public.sms_edit_requests
  where owner = auth.uid() and status = 'open' order by created_at desc limit 100;
$$;

create or replace function public.resolve_my_sms_edit_request(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('addressed','dismissed') then raise exception 'Invalid status'; end if;
  update public.sms_edit_requests set status = p_status, addressed_at = now()
  where id = p_id and owner = auth.uid() and status = 'open';
end;
$$;

-- The Edge Function (enroll action, owner bearer + AAL2 checked there too)
-- passes the hash of the code it will text. Nothing about the code is stored
-- in clear.
create or replace function public.sms_channel_begin_verification(
  p_phone text, p_code_hash text, p_consent_version text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  perform public.require_aal2();
  if coalesce(p_phone, '') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be E.164 (+15551234567)';
  end if;
  if coalesce(p_code_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid code hash'; end if;
  if char_length(coalesce(p_consent_version, '')) not between 1 and 40 then
    raise exception 'Consent version required';
  end if;
  if exists (
    select 1 from public.owner_sms_channels
    where phone_e164 = p_phone and owner <> v_owner and status in ('pending_verification','active','paused')
  ) then raise exception 'This number is already enrolled on another account'; end if;

  insert into public.owner_sms_channels (
    owner, phone_e164, status, verification_code_hash, verification_expires_at,
    verification_attempts, consent_version, consented_at
  ) values (
    v_owner, p_phone, 'pending_verification', p_code_hash, now() + interval '10 minutes',
    0, p_consent_version, now()
  )
  on conflict (owner) do update set
    phone_e164 = excluded.phone_e164,
    status = 'pending_verification',
    verification_code_hash = excluded.verification_code_hash,
    verification_expires_at = excluded.verification_expires_at,
    verification_attempts = 0,
    consent_version = excluded.consent_version,
    consented_at = now();
end;
$$;

create or replace function public.sms_channel_confirm_verification(p_code_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_row public.owner_sms_channels%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  perform public.require_aal2();
  select * into v_row from public.owner_sms_channels where owner = v_owner for update;
  if not found or v_row.status <> 'pending_verification' then
    raise exception 'No verification is pending';
  end if;
  if v_row.verification_attempts >= 5 or v_row.verification_expires_at < now() then
    update public.owner_sms_channels set verification_code_hash = '', verification_expires_at = null
    where owner = v_owner;
    raise exception 'Verification expired; request a new code';
  end if;
  if v_row.verification_code_hash = '' or v_row.verification_code_hash <> coalesce(p_code_hash, '') then
    update public.owner_sms_channels set verification_attempts = verification_attempts + 1
    where owner = v_owner;
    return false;
  end if;
  update public.owner_sms_channels set status = 'active', verification_code_hash = '',
    verification_expires_at = null, verification_attempts = 0
  where owner = v_owner;
  return true;
end;
$$;

create or replace function public.save_sms_channel_settings(
  p_backend_id uuid, p_notify_types text[], p_assistant_enabled boolean, p_paused boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_status text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  perform public.require_aal2();
  if p_backend_id is not null and not exists (
    select 1 from public.ai_backends where id = p_backend_id and owner = v_owner
  ) then raise exception 'Choose one of your own linked models'; end if;
  if p_notify_types is null or array_length(p_notify_types, 1) is null then
    raise exception 'Choose at least one notification type';
  end if;
  if exists (
    select 1 from unnest(p_notify_types) t where t not in ('content_review','agent_board_review')
  ) then raise exception 'Unknown notification type'; end if;
  select status into v_status from public.owner_sms_channels where owner = v_owner for update;
  if not found or v_status = 'pending_verification' then
    raise exception 'Verify your number first';
  end if;
  update public.owner_sms_channels set
    backend_id = p_backend_id,
    notify_types = (select array_agg(distinct t order by t) from unnest(p_notify_types) t),
    assistant_enabled = coalesce(p_assistant_enabled, true),
    status = case when p_paused then 'paused' else 'active' end
  where owner = v_owner and status in ('active','paused');
end;
$$;

create or replace function public.revoke_sms_channel()
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  perform public.require_aal2();
  update public.owner_sms_channels set status = 'revoked', backend_id = null,
    verification_code_hash = '', verification_expires_at = null
  where owner = v_owner;
  update public.sms_approval_tokens set status = 'expired'
  where owner = v_owner and status = 'open';
  update public.sms_messages set status = 'ignored'
  where owner = v_owner and direction = 'outbound' and status in ('queued','failed');
end;
$$;

-- ----------------------------------------------------------------------
-- Service RPCs — used only by the sms-approvals Edge Function
-- ----------------------------------------------------------------------
create or replace function public.sms_resolve_inbound_service(p_phone text)
returns table (
  owner uuid, status text, backend_id uuid, assistant_enabled boolean,
  inbound_today int, assistant_today int, daily_inbound_limit int, daily_assistant_limit int
)
language sql security definer stable set search_path = '' as $$
  select c.owner, c.status, c.backend_id, c.assistant_enabled,
    (select count(*)::int from public.sms_messages m
      where m.owner = c.owner and m.direction = 'inbound' and m.created_at > now() - interval '24 hours'),
    (select count(*)::int from public.sms_messages m
      where m.owner = c.owner and m.direction = 'outbound' and m.kind = 'assistant'
        and m.created_at > now() - interval '24 hours'),
    c.daily_inbound_limit, c.daily_assistant_limit
  from public.owner_sms_channels c
  where c.phone_e164 = p_phone and c.status in ('active','paused');
$$;

create or replace function public.sms_record_message_service(
  p_owner uuid, p_phone text, p_direction text, p_kind text, p_body text,
  p_status text, p_provider_sid text default '', p_token_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.sms_messages (owner, phone_e164, direction, kind, body, status, provider_sid, token_id, sent_at)
  values (p_owner, p_phone, p_direction, p_kind, left(coalesce(nullif(p_body, ''), '(empty)'), 1600),
          p_status, coalesce(p_provider_sid, ''), p_token_id,
          case when p_status in ('sent','delivered') then now() end)
  on conflict (provider_sid) where provider_sid <> '' do nothing
  returning id into v_id;
  if p_direction = 'inbound' then
    update public.owner_sms_channels set last_inbound_at = now() where owner = p_owner;
  end if;
  return v_id;
end;
$$;

-- Apply a texted decision. Mirrors approve_/reject_agent_board_request and
-- approve_content_package, with the same review-hash and completeness checks,
-- but authenticated by the bound token rather than auth.uid().
create or replace function public.sms_decide_service(
  p_owner uuid, p_code text, p_decision text, p_note text default ''
)
returns table (ok boolean, message text, subject_type text, subject_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_token public.sms_approval_tokens%rowtype;
  v_note text := left(coalesce(p_note, ''), 1000);
  v_payload jsonb; v_hash text; v_status text; v_channels text[]; v_pkg_hash text;
  v_label text;
begin
  if p_decision not in ('approve','reject','edit') then
    return query select false, 'Unknown decision', null::text, null::uuid; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text, 51051120));

  select * into v_token from public.sms_approval_tokens
  where owner = p_owner and code = upper(p_code) and status = 'open' for update;
  if not found then
    return query select false, 'No open item matches code ' || upper(coalesce(p_code, '')) || '. Text LIST to see what is waiting.', null::text, null::uuid; return;
  end if;
  if v_token.expires_at < now() then
    update public.sms_approval_tokens set status = 'expired' where id = v_token.id;
    return query select false, 'Code ' || v_token.code || ' expired. Open the app to decide this one.', v_token.subject_type, v_token.subject_id; return;
  end if;

  if v_token.subject_type = 'agent_board_request' then
    v_label := 'Agent task';
    select status into v_status from public.agent_board_requests
    where id = v_token.subject_id and owner = p_owner for update;
    if not found or v_status <> 'owner_review' then
      update public.sms_approval_tokens set status = 'superseded' where id = v_token.id;
      return query select false, 'That agent task is no longer awaiting review.', v_token.subject_type, v_token.subject_id; return;
    end if;
    if p_decision = 'approve' then
      v_payload := public.agent_board_review_payload(v_token.subject_id, p_owner);
      v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
      if v_hash <> v_token.review_hash then
        update public.sms_approval_tokens set status = 'superseded' where id = v_token.id;
        -- Re-issue so the owner gets the current payload.
        perform public.sms_notify_agent_board_review_reissue(v_token.subject_id, p_owner);
        return query select false, 'That task changed since it was texted to you. A fresh code is on its way.', v_token.subject_type, v_token.subject_id;
        return;
      end if;
      update public.agent_board_requests set status = 'approved', approved_by = p_owner,
        approved_at = now(), rejected_by = null, rejected_at = null, rejection_reason = '',
        review_payload = v_payload, review_hash = v_hash,
        approved_review_payload = v_payload, approved_review_hash = v_hash, updated_at = now()
      where id = v_token.subject_id and owner = p_owner;
      insert into public.agent_board_decisions (owner, request_id, actor, decision, notes)
      values (p_owner, v_token.subject_id, p_owner, 'approved', 'via sms ' || v_token.code || case when v_note <> '' then ': ' || v_note else '' end);
    elsif p_decision = 'reject' then
      update public.agent_board_requests set status = 'rejected', rejected_by = p_owner,
        rejected_at = now(), rejection_reason = v_note, updated_at = now()
      where id = v_token.subject_id and owner = p_owner;
      insert into public.agent_board_decisions (owner, request_id, actor, decision, notes)
      values (p_owner, v_token.subject_id, p_owner, 'rejected', 'via sms ' || v_token.code);
    else
      if v_note = '' then
        return query select false, 'Tell me what to change: EDIT ' || v_token.code || ' <note>.', v_token.subject_type, v_token.subject_id; return;
      end if;
      insert into public.sms_edit_requests (owner, persona_id, subject_type, subject_id, note)
      values (p_owner, v_token.persona_id, v_token.subject_type, v_token.subject_id, v_note);
      insert into public.agent_board_decisions (owner, request_id, actor, decision, notes)
      values (p_owner, v_token.subject_id, p_owner, 'escalated', 'edit requested via sms ' || v_token.code || ': ' || v_note);
    end if;

  else -- content_package
    v_label := 'Content kit';
    select status into v_status from public.persona_content_packages
    where id = v_token.subject_id and owner = p_owner for update;
    if not found or v_status <> 'owner_review' then
      update public.sms_approval_tokens set status = 'superseded' where id = v_token.id;
      return query select false, 'That content kit is no longer awaiting review.', v_token.subject_type, v_token.subject_id; return;
    end if;
    if p_decision = 'approve' then
      select array_agg(channel order by channel) into v_channels
      from public.persona_content_variants
      where package_id = v_token.subject_id and owner = p_owner and body <> '';
      if v_channels is distinct from array['facebook','instagram','website','x']::text[] then
        return query select false, 'That kit is incomplete (needs X, Instagram, Facebook, and website). Finish it in the app.', v_token.subject_type, v_token.subject_id; return;
      end if;
      select public.content_package_hash(v_token.subject_id) into v_pkg_hash;
      update public.persona_content_packages
      set status = 'approved', approval_hash = v_pkg_hash, approved_at = now(),
          approved_by = p_owner, scheduled_for = null, updated_at = now()
      where id = v_token.subject_id and owner = p_owner;
      update public.persona_content_variants set status = 'approved', updated_at = now()
      where package_id = v_token.subject_id and owner = p_owner;
    elsif p_decision = 'reject' then
      update public.persona_content_packages
      set status = 'rejected', owner_guidance = left(
            coalesce(owner_guidance, '') || case when v_note <> '' then E'\n[SMS reject] ' || v_note else '' end, 6000),
          updated_at = now()
      where id = v_token.subject_id and owner = p_owner;
    else
      if v_note = '' then
        return query select false, 'Tell me what to change: EDIT ' || v_token.code || ' <note>.', v_token.subject_type, v_token.subject_id; return;
      end if;
      insert into public.sms_edit_requests (owner, persona_id, subject_type, subject_id, note)
      values (p_owner, v_token.persona_id, v_token.subject_type, v_token.subject_id, v_note);
      update public.persona_content_packages
      set owner_guidance = left(coalesce(owner_guidance, '') || E'\n[SMS edit request] ' || v_note, 6000),
          updated_at = now()
      where id = v_token.subject_id and owner = p_owner;
    end if;
  end if;

  update public.sms_approval_tokens
  set status = case when p_decision = 'edit' then 'open' else 'used' end,
      decision = case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'edit_requested' end,
      decision_note = v_note, decided_at = now()
  where id = v_token.id;

  insert into public.persona_activity_events (owner, persona_id, event_type, source, summary, subject_type, subject_id, metadata)
  values (p_owner, v_token.persona_id,
    case p_decision when 'approve' then 'sms_approved' when 'reject' then 'sms_rejected' else 'sms_edit_requested' end,
    'owner',
    v_label || ' ' || case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'sent back for edits' end || ' by SMS',
    v_token.subject_type, v_token.subject_id, jsonb_build_object('code', v_token.code, 'note', v_note));

  return query select true,
    case p_decision
      when 'approve' then v_label || ' ' || v_token.code || ' approved. ' ||
        case when v_token.subject_type = 'content_package'
          then 'Schedule it from the app when ready.' else 'It will run on the next board pass.' end
      when 'reject' then v_label || ' ' || v_token.code || ' rejected.'
      else 'Edit request logged for ' || v_token.code || '. The code stays open until the revised version is reviewed.' end,
    v_token.subject_type, v_token.subject_id;
end;
$$;

-- Re-issue helper used when a texted agent-board payload has drifted.
create or replace function public.sms_notify_agent_board_review_reissue(p_request_id uuid, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.agent_board_requests%rowtype; v_payload jsonb; v_hash text; v_name text;
begin
  select * into r from public.agent_board_requests where id = p_request_id and owner = p_owner;
  if not found or r.status <> 'owner_review' then return; end if;
  v_payload := public.agent_board_review_payload(r.id, r.owner);
  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  select name into v_name from public.personas where id = r.target_persona_id;
  perform public.sms_issue_token_service(r.owner, 'agent_board_request', r.id, r.target_persona_id, v_hash,
    'Updated agent task for ' || coalesce(v_name, 'persona') || ' (' || r.task_type || ')', left(r.instructions, 700));
end;
$$;

-- What is waiting (for LIST / STATUS and for the assistant).
create or replace function public.sms_pending_service(p_owner uuid)
returns table (code text, subject_type text, subject_id uuid, persona_name text, title text, expires_at timestamptz)
language sql security definer stable set search_path = '' as $$
  select t.code, t.subject_type, t.subject_id, p.name,
    case t.subject_type
      when 'agent_board_request' then (select r.task_type || ' (' || r.risk_level || ' risk)' from public.agent_board_requests r where r.id = t.subject_id)
      else (select coalesce(nullif(c.title, ''), 'untitled kit') from public.persona_content_packages c where c.id = t.subject_id) end,
    t.expires_at
  from public.sms_approval_tokens t
  left join public.personas p on p.id = t.persona_id
  where t.owner = p_owner and t.status = 'open' and t.expires_at > now()
  order by t.created_at desc limit 20;
$$;

-- Read-only context for the assistant. Never includes credentials, tokens,
-- provider ids, private owner identity, or fan data.
create or replace function public.sms_assistant_context_service(p_owner uuid)
returns jsonb language sql security definer stable set search_path = '' as $$
  select jsonb_build_object(
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'handle', p.handle, 'name', p.name, 'tagline', p.tagline,
        'visibility', p.visibility, 'purpose', left(p.purpose, 600), 'voice', left(p.voice, 600),
        'audience', left(p.audience, 400), 'topics', left(p.topics, 400), 'dont', left(p.dont, 400),
        'automation', (select jsonb_build_object(
            'proposals_enabled', s.proposals_enabled, 'execution_enabled', s.execution_enabled,
            'approval_required', s.approval_required, 'allowed_task_types', s.allowed_task_types,
            'daily_proposal_limit', s.daily_proposal_limit)
          from public.agent_board_settings s where s.persona_id = p.id),
        'binding', (select jsonb_build_object('status', b.status, 'autonomy_level', b.autonomy_level,
            'fan_chat_enabled', b.fan_chat_enabled, 'fan_daily_message_limit', b.fan_daily_message_limit)
          from public.agent_bindings b where b.persona_id = p.id),
        'research', (select jsonb_build_object('enabled', r.research_enabled, 'frequency', r.brief_frequency,
            'depth', r.research_depth, 'source_types', r.source_types)
          from public.persona_research_settings r where r.persona_id = p.id),
        'content_plan', (select jsonb_build_object('primary_goal', left(cp.primary_goal, 300),
            'content_pillars', left(cp.content_pillars, 400), 'current_campaign', left(cp.current_campaign, 300),
            'calls_to_action', left(cp.calls_to_action, 300))
          from public.persona_content_plans cp where cp.persona_id = p.id)
      ) order by p.name)
      from public.personas p where p.owner = p_owner), '[]'::jsonb),
    'owner_settings', (select jsonb_build_object(
        'automation_paused', s.automation_paused, 'pause_reason', s.pause_reason,
        'default_timezone', s.default_timezone, 'daily_draft_limit', s.daily_draft_limit,
        'quiet_hours_start', s.quiet_hours_start, 'quiet_hours_end', s.quiet_hours_end)
      from public.agent_owner_settings s where s.owner = p_owner),
    'pending_approvals', coalesce((
      select jsonb_agg(jsonb_build_object('code', q.code, 'type', q.subject_type, 'persona', q.persona_name,
        'title', q.title, 'expires_at', q.expires_at))
      from public.sms_pending_service(p_owner) q), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object('at', e.occurred_at, 'persona', p.name, 'event', e.event_type, 'summary', e.summary))
      from (select * from public.persona_activity_events where owner = p_owner order by occurred_at desc limit 15) e
      left join public.personas p on p.id = e.persona_id), '[]'::jsonb)
  );
$$;

create or replace function public.sms_recent_conversation_service(p_owner uuid, p_limit int default 12)
returns table (direction text, kind text, body text, created_at timestamptz)
language sql security definer stable set search_path = '' as $$
  select direction, kind, body, created_at from public.sms_messages
  where owner = p_owner and status not in ('failed','ignored')
  order by created_at desc limit greatest(1, least(coalesce(p_limit, 12), 40));
$$;

-- Outbound queue for the dispatcher.
create or replace function public.sms_claim_outbound_service(p_limit int default 25)
returns setof public.sms_messages
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select m.id from public.sms_messages m
    join public.owner_sms_channels c on c.owner = m.owner
    where m.direction = 'outbound' and m.status in ('queued','failed') and m.attempts < 3
      and c.status = 'active' and c.phone_e164 = m.phone_e164
    order by m.created_at limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update of m skip locked
  )
  update public.sms_messages m set status = 'sending', attempts = m.attempts + 1
  from picked where m.id = picked.id
  returning m.*;
end;
$$;

create or replace function public.sms_mark_outbound_service(
  p_id uuid, p_status text, p_provider_sid text default '', p_error text default ''
)
returns void language sql security definer set search_path = '' as $$
  update public.sms_messages set
    status = p_status,
    provider_sid = case when coalesce(p_provider_sid, '') <> '' then p_provider_sid else provider_sid end,
    error = left(coalesce(p_error, ''), 500),
    sent_at = case when p_status in ('sent','delivered') then now() else sent_at end
  where id = p_id and direction = 'outbound';
$$;

create or replace function public.sms_expire_tokens_service()
returns int language sql security definer set search_path = '' as $$
  with done as (
    update public.sms_approval_tokens set status = 'expired'
    where status = 'open' and expires_at < now() returning 1
  ) select count(*)::int from done;
$$;

-- Account erasure hook for delete-account.
create or replace function public.delete_sms_channel_data_for_account_service(p_owner uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.sms_messages where owner = p_owner;
  delete from public.sms_approval_tokens where owner = p_owner;
  delete from public.sms_edit_requests where owner = p_owner;
  delete from public.owner_sms_channels where owner = p_owner;
$$;

-- ----------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------
revoke all on function public.sms_new_decision_code(uuid) from public, anon, authenticated, service_role;
revoke all on function public.sms_issue_token_service(uuid,text,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.sms_notify_agent_board_review_reissue(uuid,uuid) from public, anon, authenticated;
revoke all on function public.sms_resolve_inbound_service(text) from public, anon, authenticated;
revoke all on function public.sms_record_message_service(uuid,text,text,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.sms_decide_service(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.sms_pending_service(uuid) from public, anon, authenticated;
revoke all on function public.sms_assistant_context_service(uuid) from public, anon, authenticated;
revoke all on function public.sms_recent_conversation_service(uuid,int) from public, anon, authenticated;
revoke all on function public.sms_claim_outbound_service(int) from public, anon, authenticated;
revoke all on function public.sms_mark_outbound_service(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.sms_expire_tokens_service() from public, anon, authenticated;
revoke all on function public.delete_sms_channel_data_for_account_service(uuid) from public, anon, authenticated;
grant execute on function
  public.sms_issue_token_service(uuid,text,uuid,uuid,text,text,text),
  public.sms_notify_agent_board_review_reissue(uuid,uuid),
  public.sms_resolve_inbound_service(text),
  public.sms_record_message_service(uuid,text,text,text,text,text,text,uuid),
  public.sms_decide_service(uuid,text,text,text),
  public.sms_pending_service(uuid),
  public.sms_assistant_context_service(uuid),
  public.sms_recent_conversation_service(uuid,int),
  public.sms_claim_outbound_service(int),
  public.sms_mark_outbound_service(uuid,text,text,text),
  public.sms_expire_tokens_service(),
  public.delete_sms_channel_data_for_account_service(uuid)
  to service_role;

revoke all on function public.my_sms_channel() from public, anon;
revoke all on function public.my_sms_edit_requests() from public, anon;
revoke all on function public.resolve_my_sms_edit_request(uuid,text) from public, anon;
revoke all on function public.sms_channel_begin_verification(text,text,text) from public, anon;
revoke all on function public.sms_channel_confirm_verification(text) from public, anon;
revoke all on function public.save_sms_channel_settings(uuid,text[],boolean,boolean) from public, anon;
revoke all on function public.revoke_sms_channel() from public, anon;
grant execute on function
  public.my_sms_channel(), public.my_sms_edit_requests(),
  public.resolve_my_sms_edit_request(uuid,text),
  public.sms_channel_begin_verification(text,text,text),
  public.sms_channel_confirm_verification(text),
  public.save_sms_channel_settings(uuid,text[],boolean,boolean),
  public.revoke_sms_channel()
  to authenticated;

comment on table public.owner_sms_channels is
  'Opt-in SMS approval channel per owner. Service-role only; owners use my_sms_channel() and the AAL2 enrollment RPCs.';
comment on function public.sms_decide_service(uuid,text,text,text) is
  'Applies a texted APPROVE/REJECT/EDIT bound to a single-use decision code. Never schedules or publishes.';

notify pgrst, 'reload schema';

commit;
