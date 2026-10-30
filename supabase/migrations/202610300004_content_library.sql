-- Audience-scoped sessions, resources, release notes and employee experiments.
begin;
create table private.content_items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users,
 owner_workspace uuid not null references private.organisations,
 kind text not null check(kind in ('session','resource','release_note','experiment')),
 title text not null check(length(title) between 5 and 160), body text not null check(length(body) between 20 and 12000),
 audience text not null check(audience in ('public','employee','organisation')),
 target_workspace uuid references private.organisations, offering_id text references private.offerings,
 state text not null default 'draft' check(state in ('draft','submitted','published','withdrawn')),
 owner_team text not null check(length(owner_team) between 1 and 120), review_date date not null,
 starts_at timestamptz, revision integer not null default 1, media_path text, media_type text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(audience='public' or target_workspace is not null),
 check(kind<>'experiment' or audience='employee')
);
create table private.publisher_assignments (
 user_id uuid references auth.users, employee_workspace uuid references private.organisations,
 target_workspace uuid references private.organisations, primary key(user_id,employee_workspace,target_workspace)
);
create table private.content_feedback (
 item_id uuid references private.content_items, user_id uuid references auth.users, workspace_id uuid references private.organisations,
 rating text not null check(rating in ('useful','needs_update')), primary key(item_id,user_id,workspace_id)
);
alter table private.content_items enable row level security;
alter table private.publisher_assignments enable row level security;
alter table private.content_feedback enable row level security;
revoke all on private.content_items,private.publisher_assignments,private.content_feedback from public,anon,authenticated;

create function private.content_read(p_item uuid,p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.content_items c where c.id=p_item and c.state='published'
 and (c.audience='public' or private.member(p_workspace) and c.target_workspace=p_workspace
 and (c.audience='organisation' or exists(select 1 from private.organisations o where o.id=p_workspace and o.kind='employee')))
 and (c.offering_id is null or c.audience='public' or private.entitled(p_workspace,c.offering_id)))
$$;
create function private.content_edit(p_item uuid,p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.content_items c where c.id=p_item and c.owner_workspace=p_workspace and c.state<>'withdrawn'
 and (c.target_workspace is null or c.target_workspace=p_workspace or exists(select 1 from private.publisher_assignments a where a.user_id=auth.uid() and a.employee_workspace=p_workspace and a.target_workspace=c.target_workspace))
 and private.member(p_workspace) and (c.offering_id is null or private.entitled(p_workspace,c.offering_id)) and (c.owner_id=auth.uid() and c.kind='experiment' and private.cap(p_workspace,'observations.write')
 or private.cap(p_workspace,case when c.kind='session' then 'broadcast.publish' else 'content.publish' end)
 and (c.owner_id=auth.uid() or c.state in ('submitted','published'))))
$$;
create function private.content_json(c private.content_items) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',c.id,'kind',c.kind,'title',c.title,'body',c.body,'audience',c.audience,'offeringId',c.offering_id,
 'ownerTeam',c.owner_team,'reviewDate',c.review_date,'startsAt',c.starts_at,'revision',c.revision,'state',c.state,'hasMedia',c.media_path is not null,'mediaType',c.media_type,'updatedAt',c.updated_at)
$$;
create function private.storage_content_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.content_items c where c.media_path=p_name and (private.content_read(c.id,c.target_workspace)
 or private.content_edit(c.id,c.owner_workspace)))
$$;
create function private.storage_content_write(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.content_items c where split_part(p_name,'/',1)=c.id::text and c.state='draft' and private.content_edit(c.id,c.owner_workspace))
$$;
revoke all on function private.content_read(uuid,uuid),private.content_edit(uuid,uuid),private.content_json(private.content_items),private.storage_content_read(text),private.storage_content_write(text) from public,anon,authenticated;
-- Storage policies need these narrow booleans, never a table SELECT grant.
grant usage on schema private to anon;
grant execute on function private.storage_content_read(text) to anon,authenticated;
grant execute on function private.storage_content_write(text) to authenticated;
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
 if exists(select 1 from storage.buckets where id='portal-media' and public) then raise exception 'PORTAL_MEDIA_BUCKET_MUST_BE_PRIVATE'; end if;
 execute $q$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portal-media','portal-media',false,20971520,array['video/mp4','video/webm','application/pdf']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$q$;
 execute $q$create policy portal_media_read on storage.objects for select to anon,authenticated using(bucket_id='portal-media' and private.storage_content_read(name))$q$;
 execute $q$create policy portal_media_insert on storage.objects for insert to authenticated with check(bucket_id='portal-media' and private.storage_content_write(name))$q$;
 end if;
end $$;

create function public.content_public(p_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('items',coalesce((select jsonb_agg(private.content_json(c)||jsonb_build_object('mediaPath',c.media_path,'mediaType',c.media_type) order by c.updated_at desc) from (select * from private.content_items where state='published' and audience='public' and (p_id is null or id=p_id) order by updated_at desc limit 50)c),'[]'::jsonb))
$$;
revoke all on function public.content_public(uuid) from public;
grant execute on function public.content_public(uuid) to anon,authenticated;

alter function public.portal(text,uuid,jsonb) rename to portal_learning;
alter function public.portal_learning(text,uuid,jsonb) set schema private;
revoke all on function private.portal_learning(text,uuid,jsonb) from public,anon,authenticated;
create function public.portal(p_action text,p_workspace uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; target uuid; item private.content_items; request_key uuid; desired_kind text; desired_audience text; desired_workspace uuid; required_cap text;
begin
 if p_action not like 'content.%' and p_action<>'dashboard' then return private.portal_learning(p_action,p_workspace,p_payload); end if;
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'SIGN_IN_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform 1 from private.memberships where organisation_id=p_workspace and user_id=actor for share;
 if not private.member(p_workspace) then raise exception 'WORKSPACE_DENIED' using errcode='42501'; end if;
 if p_action='dashboard' then
 result:=private.portal_learning(p_action,p_workspace,p_payload);
 return result||jsonb_build_object('sessions',coalesce((select jsonb_agg(private.content_json(c)) from private.content_items c where c.kind='session' and private.content_read(c.id,p_workspace)),'[]'::jsonb),
 'experiments',coalesce((select jsonb_agg(private.content_json(c)) from private.content_items c where c.kind='experiment' and private.content_read(c.id,p_workspace)),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(private.content_json(c)) from private.content_items c where c.kind in ('resource','release_note') and private.content_read(c.id,p_workspace)),'[]'::jsonb));
 elsif p_action='content.list' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(private.content_json(c)||jsonb_build_object('canEdit',private.content_edit(c.id,p_workspace),'canPublish',private.content_edit(c.id,p_workspace) and private.cap(p_workspace,case when c.kind='session' then 'broadcast.publish' else 'content.publish' end))||case when private.content_edit(c.id,p_workspace) then jsonb_build_object('targetWorkspace',c.target_workspace) else '{}'::jsonb end order by c.updated_at desc) from (select * from private.content_items c where (private.content_read(c.id,p_workspace) or c.owner_workspace=p_workspace and (c.owner_id=actor or private.content_edit(c.id,p_workspace))) and (not(p_payload?'kind') or c.kind=p_payload->>'kind') order by c.updated_at desc limit 50)c),'[]'::jsonb));
 elsif p_action in ('content.asset','content.get') then
 select * into item from private.content_items where id=(p_payload->>'id')::uuid;
 if not found or not(private.content_read(item.id,p_workspace) or private.content_edit(item.id,p_workspace)) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if p_action='content.get' then return private.content_json(item); end if;
 if item.media_path is null then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 return jsonb_build_object('path',item.media_path,'type',item.media_type);
 elsif p_action='content.upload' then
 select * into item from private.content_items where id=(p_payload->>'id')::uuid;
 if not found or item.state<>'draft' or not private.content_edit(item.id,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 return jsonb_build_object('id',item.id,'revision',item.revision);
 end if;
 request_key:=(p_payload->>'requestId')::uuid;
 if request_key is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 select response into result from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=request_key;
 if found then return result; end if;
 target:=(p_payload->>'id')::uuid;
 if p_action='content.save' then
 desired_kind:=p_payload->>'kind'; desired_audience:=p_payload->>'audience';
 desired_workspace:=case when desired_audience='public' then null else coalesce((p_payload->>'targetWorkspace')::uuid,p_workspace) end;
 required_cap:=case when desired_kind='session' then 'broadcast.publish' else 'content.publish' end;
 if desired_kind='experiment' then
 if desired_audience<>'employee' or desired_workspace<>p_workspace or not private.cap(p_workspace,'observations.write') or not exists(select 1 from private.organisations where id=p_workspace and kind='employee') then raise exception 'EMPLOYEE_REQUIRED' using errcode='42501'; end if;
 elsif not private.cap(p_workspace,required_cap) then raise exception 'PUBLISHER_REQUIRED' using errcode='42501'; end if;
 if desired_audience='employee' and not exists(select 1 from private.organisations where id=desired_workspace and kind='employee') then raise exception 'AUDIENCE_DENIED' using errcode='42501'; end if;
 if desired_workspace is not null and desired_workspace<>p_workspace and not exists(select 1 from private.publisher_assignments where user_id=actor and employee_workspace=p_workspace and target_workspace=desired_workspace) then raise exception 'PUBLISHER_ASSIGNMENT_REQUIRED' using errcode='42501'; end if;
 if p_payload->>'offeringId' is not null and (not private.entitled(p_workspace,p_payload->>'offeringId') or desired_workspace is not null and not exists(select 1 from private.entitlements where organisation_id=desired_workspace and offering_id=p_payload->>'offeringId' and enabled)) then raise exception 'OFFERING_DENIED' using errcode='42501'; end if;
 if target is null then
 insert into private.content_items(owner_id,owner_workspace,kind,title,body,audience,target_workspace,offering_id,owner_team,review_date,starts_at)
 values(actor,p_workspace,desired_kind,btrim(p_payload->>'title'),btrim(p_payload->>'body'),desired_audience,desired_workspace,p_payload->>'offeringId',btrim(p_payload->>'ownerTeam'),(p_payload->>'reviewDate')::date,(p_payload->>'startsAt')::timestamptz) returning id into target;
 else
 select * into item from private.content_items where id=target for update;
 if not found or not private.content_edit(target,p_workspace) or item.kind<>desired_kind or item.state='withdrawn' then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if item.revision is distinct from (p_payload->>'expectedRevision')::integer then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 update private.content_items set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),audience=desired_audience,target_workspace=desired_workspace,offering_id=p_payload->>'offeringId',owner_team=btrim(p_payload->>'ownerTeam'),review_date=(p_payload->>'reviewDate')::date,starts_at=(p_payload->>'startsAt')::timestamptz,state='draft',revision=revision+1,updated_at=now() where id=target;
 end if;
 elsif p_action in ('content.publish','content.withdraw','content.submit','content.attach') then
 select * into item from private.content_items where id=target for update;
 if not found or not private.content_edit(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if item.revision is distinct from (p_payload->>'expectedRevision')::integer then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 if p_action='content.publish' then
 if not private.cap(p_workspace,case when item.kind='session' then 'broadcast.publish' else 'content.publish' end) or item.state not in ('draft','submitted') then raise exception 'PUBLISHER_REQUIRED' using errcode='42501'; end if;
 update private.content_items set state='published',updated_at=now() where id=target;
 elsif p_action='content.submit' then
 if item.owner_id<>actor or item.kind<>'experiment' or item.state<>'draft' then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 update private.content_items set state='submitted',updated_at=now() where id=target;
 elsif p_action='content.withdraw' then update private.content_items set state='withdrawn',updated_at=now() where id=target;
 else
 if item.state<>'draft' or p_payload->>'path' is null or p_payload->>'type' is null or split_part(coalesce(p_payload->>'path',''), '/',1)<>target::text or (p_payload->>'path') !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$' or p_payload->>'type' not in ('video/mp4','video/webm','application/pdf') then raise exception 'INVALID_MEDIA' using errcode='22023'; end if;
 update private.content_items set media_path=p_payload->>'path',media_type=p_payload->>'type',updated_at=now() where id=target;
 end if;
 elsif p_action='content.feedback' then
 if not private.content_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 insert into private.content_feedback values(target,actor,p_workspace,p_payload->>'rating') on conflict(item_id,user_id,workspace_id) do update set rating=excluded.rating;
 else raise exception 'UNKNOWN_ACTION' using errcode='22023'; end if;
 result:=jsonb_build_object('id',target,'ok',true,'revision',(select revision from private.content_items where id=target));
 insert into private.requests values(actor,p_workspace,p_action,request_key,result);
 insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,p_workspace,p_action,target);
 return result;
end $$;
revoke all on function public.portal(text,uuid,jsonb) from public,anon;
grant execute on function public.portal(text,uuid,jsonb) to authenticated;
commit;
