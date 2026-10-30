begin;
create table private.teams (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references private.organisations,
 owner_id uuid not null references auth.users, name text not null check(length(name) between 3 and 100),
 description text not null check(length(description) between 10 and 2000), created_at timestamptz not null default now()
);
create table private.team_members (
 team_id uuid references private.teams, user_id uuid references auth.users, primary key(team_id,user_id)
);
create table private.team_posts (
 id uuid primary key default gen_random_uuid(),team_id uuid not null references private.teams,
 author_id uuid not null references auth.users,body text not null check(length(body) between 5 and 3000),created_at timestamptz not null default now()
);
alter table private.teams enable row level security;
alter table private.team_members enable row level security;
alter table private.team_posts enable row level security;
revoke all on private.teams,private.team_members,private.team_posts from public,anon,authenticated;
alter function public.portal(text,uuid,jsonb) rename to portal_content;
alter function public.portal_content(text,uuid,jsonb) set schema private;
revoke all on function private.portal_content(text,uuid,jsonb) from public,anon,authenticated;
create function public.portal(p_action text,p_workspace uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; team private.teams; request_key uuid; result jsonb; member_id uuid;
begin
 if p_action not like 'teams.%' then return private.portal_content(p_action,p_workspace,p_payload); end if;
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'SIGN_IN_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform 1 from private.memberships where organisation_id=p_workspace and user_id=actor for share;
 if not private.member(p_workspace) or not exists(select 1 from private.organisations where id=p_workspace and kind='employee') then raise exception 'EMPLOYEE_REQUIRED' using errcode='42501'; end if;
 if p_action='teams.list' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'description',t.description,'owner',t.owner_id=actor)) from private.teams t join private.team_members m on m.team_id=t.id where t.workspace_id=p_workspace and m.user_id=actor),'[]'::jsonb)); end if;
 target:=(p_payload->>'id')::uuid;
 if p_action<>'teams.create' then
 select * into team from private.teams where id=target for update;
 if not found or team.workspace_id<>p_workspace or not exists(select 1 from private.team_members where team_id=target and user_id=actor) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if p_action='teams.get' then
 return jsonb_build_object('id',team.id,'name',team.name,'description',team.description,'owner',team.owner_id=actor,
 'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'owner',m.user_id=team.owner_id)) from private.team_members m where m.team_id=target),
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'body',p.body,'own',p.author_id=actor,'createdAt',p.created_at) order by p.created_at) from (select * from private.team_posts where team_id=target order by created_at desc limit 50)p),'[]'::jsonb)); end if;
 end if;
 request_key:=(p_payload->>'requestId')::uuid;
 if request_key is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 select response into result from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=request_key;
 if found then return result; end if;
 if p_action='teams.create' then
 if not private.cap(p_workspace,'observations.write') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if (select count(*) from private.teams where owner_id=actor and workspace_id=p_workspace)>=10 then raise exception 'TEAM_LIMIT' using errcode='22023'; end if;
 insert into private.teams(workspace_id,owner_id,name,description) values(p_workspace,actor,btrim(p_payload->>'name'),btrim(p_payload->>'description')) returning id into target;
 insert into private.team_members values(target,actor);
 elsif p_action in ('teams.add','teams.remove') then
 if team.owner_id<>actor then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
 member_id:=(p_payload->>'userId')::uuid;
 if p_action='teams.add' then
 if not exists(select 1 from private.memberships m join auth.users u on u.id=m.user_id where m.user_id=member_id and m.organisation_id=p_workspace and m.role='employee' and m.approved and m.revoked_at is null and m.work_identity_verified and u.email_confirmed_at is not null and lower(u.email) like '%@azentio.com') then raise exception 'VERIFIED_EMPLOYEE_REQUIRED' using errcode='42501'; end if;
 insert into private.team_members values(target,member_id) on conflict do nothing;
 else
 if member_id=team.owner_id then raise exception 'OWNER_CANNOT_BE_REMOVED' using errcode='22023'; end if;
 delete from private.team_members where team_id=target and user_id=member_id;
 end if;
 elsif p_action='teams.post' then
 if not private.cap(p_workspace,'observations.write') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 insert into private.team_posts(team_id,author_id,body) values(target,actor,btrim(p_payload->>'body'));
 else raise exception 'UNKNOWN_ACTION' using errcode='22023'; end if;
 result:=jsonb_build_object('id',target,'ok',true);
 insert into private.requests values(actor,p_workspace,p_action,request_key,result);
 insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,p_workspace,p_action,target);
 return result;
end $$;
revoke all on function public.portal(text,uuid,jsonb) from public,anon;
grant execute on function public.portal(text,uuid,jsonb) to authenticated;
commit;
