\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','07800000-0000-4000-8000-000000000011',false);
select set_config('request.jwt.claim.aal','aal2',false);
select public.update_ai_backend('07800000-0000-4000-8000-000000000001','renamed','new-model','{}','https://api.openai.com/v1');
do $$ begin
 begin
  perform public.update_ai_backend('07800000-0000-4000-8000-000000000002','stolen','model','{}',null);
  raise exception 'foreign edit accepted';
 exception when others then
  if sqlerrm <> 'Owned model connection not found' then raise; end if;
 end;
 begin
  perform public.update_ai_backend('07800000-0000-4000-8000-000000000001','invalid','model','{}','http://localhost:1234');
  raise exception 'http endpoint accepted';
 exception when others then
  if sqlerrm <> 'Hosted model connections require a valid HTTPS base URL' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.aal','aal1',false);
do $$ begin
 begin
  perform public.update_ai_backend('07800000-0000-4000-8000-000000000001','low-assurance','model');
  raise exception 'AAL1 edit accepted';
 exception when others then
  if sqlerrm <> 'AAL2 required' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if (select name from public.ai_backends where id='07800000-0000-4000-8000-000000000001') <> 'renamed' then raise exception 'Owned update lost'; end if;
 if (select name from public.ai_backends where id='07800000-0000-4000-8000-000000000002') <> 'foreign' then raise exception 'Foreign row changed'; end if;
 if exists(select 1 from public.ai_backends where api_key <> 'fixture-only') then raise exception 'Key changed'; end if;
 if has_function_privilege('anon','public.update_ai_backend(uuid,text,text,jsonb,text)','EXECUTE') then raise exception 'Anonymous execute remains'; end if;
end $$;
select '078-owner-edit-runtime-ok' as result;
