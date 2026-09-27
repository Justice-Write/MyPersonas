\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
-- Fixture only: the production require_aal2 definition is not replaced by this test.
create function public.require_aal2() returns void language plpgsql as $$
begin
 if current_setting('request.jwt.claim.aal',true) is distinct from 'aal2' then raise exception 'AAL2 required'; end if;
end $$;
create table public.ai_backends(id uuid primary key,owner uuid,name text,model text,extra jsonb,base_url text,api_key text);
insert into public.ai_backends values
 ('07800000-0000-4000-8000-000000000001','07800000-0000-4000-8000-000000000011','original','model','{}','https://api.openai.com/v1','fixture-only'),
 ('07800000-0000-4000-8000-000000000002','07800000-0000-4000-8000-000000000012','foreign','model','{}','https://api.openai.com/v1','fixture-only');
grant usage on schema auth to authenticated;
