-- Operational controls do not grant administrators private contribution reads.
begin;
alter function public.portal(text,uuid,jsonb) rename to portal_teams;
alter function public.portal_teams(text,uuid,jsonb) set schema private;
revoke all on function private.portal_teams(text,uuid,jsonb) from public,anon,authenticated;
create function public.portal(p_action text,p_workspace uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; subject uuid; request_key uuid; result jsonb; desired_capability text; subject_role text;
begin
 if p_action not like 'admin.%' then return private.portal_teams(p_action,p_workspace,p_payload); end if;
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'SIGN_IN_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform 1 from private.memberships where organisation_id=p_workspace and user_id=actor for share;
 if not private.cap(p_workspace,'portal.admin') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action='admin.organisations' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from(select id,name,kind from private.organisations order by name limit 100)x),'[]'::jsonb),'offerings',coalesce((select jsonb_agg(to_jsonb(o)) from private.offerings o),'[]'::jsonb));
 elsif p_action='admin.audit' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(select id,actor_id,organisation_id,action,resource_id,created_at from private.audit_events order by created_at desc limit 100)x),'[]'::jsonb)); end if;
 target:=(p_payload->>'organisationId')::uuid;
 if p_action='admin.members' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'approved',m.approved,'revoked',m.revoked_at is not null,'capabilities',coalesce((select jsonb_agg(capability) from private.role_grants where organisation_id=target and user_id=m.user_id),'[]'::jsonb))) from private.memberships m where m.organisation_id=target),'[]'::jsonb),
 'entitlements',coalesce((select jsonb_agg(jsonb_build_object('offeringId',offering_id,'enabled',enabled)) from private.entitlements where organisation_id=target),'[]'::jsonb)); end if;
 request_key:=(p_payload->>'requestId')::uuid;
 if request_key is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 select response into result from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=request_key;
 if found then return result; end if;
 if p_action='admin.organisation.create' then
 insert into private.organisations(name,kind,synthetic) values(btrim(p_payload->>'name'),p_payload->>'kind',true) returning id into target;
 elsif p_action='admin.entitlement' then
 if not exists(select 1 from private.organisations where id=target) or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 insert into private.entitlements values(target,p_payload->>'offeringId',(p_payload->>'enabled')::boolean) on conflict(organisation_id,offering_id) do update set enabled=excluded.enabled;
 elsif p_action in ('admin.grant','admin.owner','admin.publisher') then
 subject:=(p_payload->>'userId')::uuid;
 if subject=actor then raise exception 'SELF_PRIVILEGE_CHANGE_DENIED' using errcode='42501'; end if;
 perform 1 from private.memberships where organisation_id=target and user_id=subject for update;
 select m.role into subject_role from private.memberships m join auth.users u on u.id=m.user_id where m.organisation_id=target and m.user_id=subject and m.approved and m.revoked_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (m.role<>'employee' or m.work_identity_verified and lower(u.email) like '%@azentio.com');
 if not found or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'APPROVED_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 if p_action='admin.publisher' then
 if subject_role<>'employee' or not exists(select 1 from private.organisations where id=(p_payload->>'targetWorkspace')::uuid) then raise exception 'INVALID_PUBLISHER_ASSIGNMENT' using errcode='42501'; end if;
 if p_payload->>'enabled'='true' then insert into private.publisher_assignments values(subject,target,(p_payload->>'targetWorkspace')::uuid) on conflict do nothing;
 else delete from private.publisher_assignments where user_id=subject and employee_workspace=target and target_workspace=(p_payload->>'targetWorkspace')::uuid; end if;
 elsif p_action='admin.owner' then
 if subject_role<>'employee' or not exists(select 1 from private.entitlements where organisation_id=target and offering_id=p_payload->>'offeringId' and enabled) then raise exception 'EMPLOYEE_ENTITLEMENT_REQUIRED' using errcode='42501'; end if;
 if p_payload->>'enabled'='true' then insert into private.owner_assignments values(target,subject,p_payload->>'offeringId') on conflict do nothing;
 else delete from private.owner_assignments where organisation_id=target and user_id=subject and offering_id=p_payload->>'offeringId'; end if;
 else
 desired_capability:=p_payload->>'capability';
 if desired_capability is null or desired_capability not in ('observations.write','learning.read','learning.report','learning.moderate','content.publish','broadcast.publish','members.manage','ideas.write','sandbox.run') then raise exception 'INVALID_CAPABILITY' using errcode='22023'; end if;
 if desired_capability in ('learning.moderate','content.publish','broadcast.publish','ideas.write') and subject_role<>'employee' or desired_capability='members.manage' and subject_role<>'client_admin' then raise exception 'ROLE_BOUNDARY_DENIED' using errcode='42501'; end if;
 if p_payload->>'enabled'='true' then insert into private.role_grants values(target,subject,desired_capability) on conflict do nothing;
 else delete from private.role_grants where organisation_id=target and user_id=subject and capability=desired_capability; end if;
 end if;
 else raise exception 'UNKNOWN_ACTION' using errcode='22023'; end if;
 result:=jsonb_build_object('id',target,'ok',true);
 insert into private.requests values(actor,p_workspace,p_action,request_key,result);
 insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,p_workspace,p_action,coalesce(subject,target));
 return result;
end $$;
revoke all on function public.portal(text,uuid,jsonb) from public,anon;
grant execute on function public.portal(text,uuid,jsonb) to authenticated;
create function public.schema_version() returns integer language sql immutable set search_path='' as $$select 6$$;
revoke all on function public.schema_version() from public;
grant execute on function public.schema_version() to anon,authenticated;
commit;
