set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.aal','aal2',false);
insert into public.owner_media_library(id,owner,persona_id,title,source_tool,kind,source_url,rights_confirmed)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','First','openart','image','https://cdn.openart.ai/example.png',true);
insert into public.owner_media_library(owner,parent_id,title,source_tool,kind,source_url,rights_confirmed)
values (auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Version 2','openart','image','https://cdn.openart.ai/version.png',true);
insert into storage.objects(bucket_id,name) values('creative-private','11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc');
do $$begin
 begin
  insert into public.owner_media_library(owner,persona_id,title,source_tool,kind,source_url,rights_confirmed) values(auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Foreign persona','openart','image','https://cdn.openart.ai/x',true);
  raise exception 'foreign persona accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.owner_media_library(owner,title,source_tool,kind,source_url,rights_confirmed,training_allowed) values(auth.uid(),'Training','openart','image','https://cdn.openart.ai/x',true,true);
  raise exception 'training accepted';
 exception when check_violation then null; end;
 begin
  insert into public.owner_media_library(owner,title,source_tool,kind,source_url,rights_confirmed) values(auth.uid(),'Host confusion','openart','image','https://cdn.openart.ai.evil.test/x',true);
  raise exception 'unsafe url accepted';
 exception when check_violation then null; end;
 begin
  update public.owner_media_library set source_url='https://cdn.openart.ai/replaced' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  raise exception 'immutable reference replaced';
 exception when insufficient_privilege then null; end;
 update storage.objects set name='11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd' where bucket_id='creative-private';
 if found then raise exception 'object replacement allowed'; end if;
end$$;
select set_config('request.jwt.claim.aal','aal1',false);
do $$begin
 if exists(select 1 from public.owner_media_library) then raise exception 'aal1 read permitted';end if;
 if exists(select 1 from storage.objects where bucket_id='creative-private') then raise exception 'aal1 storage read permitted';end if;
end$$;
select set_config('request.jwt.claim.aal','aal2',false);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin
 if exists(select 1 from public.owner_media_library) then raise exception 'cross-owner read';end if;
 if exists(select 1 from storage.objects where bucket_id='creative-private') then raise exception 'cross-owner storage read';end if;
 begin
  insert into public.owner_media_library(owner,parent_id,title,source_tool,kind,source_url,rights_confirmed) values(auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Foreign parent','openart','image','https://cdn.openart.ai/x',true);
  raise exception 'foreign parent accepted';
 exception when foreign_key_violation then null;end;
 begin
  insert into storage.objects(bucket_id,name) values('creative-private','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  raise exception 'cross-owner upload';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.aal','',false);
do $$begin
 if exists(select 1 from storage.objects where bucket_id='creative-private') then raise exception 'anonymous storage read';end if;
 begin perform * from public.owner_media_library; raise exception 'anonymous metadata read'; exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'owner isolation, AAL2, immutable media, private storage fence, persona/version binding: passed' as result;
