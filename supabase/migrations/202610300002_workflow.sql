begin;
create function public.portal(p_action text,p_workspace uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); result jsonb; obs private.observations; rev private.revisions; pub private.publications;
 inv private.invitations; idea private.ideas; target uuid; version_no integer; cap_name text; request_key uuid;
 note_text text; evidence_id uuid; page_no integer; page_size integer; new_id uuid; chosen_role text;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false) then
  raise exception 'SIGN_IN_REQUIRED' using errcode='28000';
 end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if p_action='workspaces' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'kind',o.kind,'role',m.role))
  from private.memberships m join private.organisations o on o.id=m.organisation_id where m.user_id=actor and private.member(o.id)),'[]'::jsonb));
 end if;
 -- Accepting an invitation is the only operation that precedes membership. Lock before checking single use.
 if p_action='invitations.accept' then
  select * into inv from private.invitations where id=(p_payload->>'id')::uuid for update;
  if not found or inv.intended_user_id<>actor or inv.accepted_at is not null or inv.expires_at<=now() or inv.organisation_id is distinct from p_workspace
   then raise exception 'INVITATION_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from private.organisations where id=inv.organisation_id and kind='client') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- A previously revoked membership needs organiser approval; an invitation cannot override revocation.
  if exists(select 1 from private.memberships where organisation_id=inv.organisation_id and user_id=actor) then raise exception 'MEMBERSHIP_EXISTS' using errcode='42501'; end if;
  insert into private.memberships(organisation_id,user_id,role,approved) values(inv.organisation_id,actor,inv.role,true);
  insert into private.role_grants select inv.organisation_id,actor,c from unnest(array['observations.write','learning.read','learning.report','sandbox.run']) c;
  if inv.role='client_admin' then insert into private.role_grants values(inv.organisation_id,actor,'members.manage'); end if;
  update private.invitations set accepted_at=now() where id=inv.id;
  insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,inv.organisation_id,p_action,inv.id);
  return jsonb_build_object('accepted',true);
 end if;
 if p_workspace is null or not private.member(p_workspace) then raise exception 'WORKSPACE_DENIED' using errcode='42501'; end if;
 -- Keep membership revocation ordered with an in-flight transaction.
 perform 1 from private.memberships where organisation_id=p_workspace and user_id=actor for share;
 page_no:=coalesce((p_payload->>'page')::integer,0); page_size:=coalesce((p_payload->>'pageSize')::integer,20);
 if page_no<0 or page_no>500 or page_size<1 or page_size>50 then raise exception 'INVALID_PAGE' using errcode='22023'; end if;
 if p_action='dashboard' then
  return jsonb_build_object('workspaceId',p_workspace,'capabilities',coalesce((select jsonb_agg(capability) from private.role_grants where organisation_id=p_workspace and user_id=actor),'[]'::jsonb),
   'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title)) from private.offerings o where private.entitled(p_workspace,o.id)),'[]'::jsonb),
   'contributionCount',(select count(*) from private.observations where organisation_id=p_workspace and author_id=actor),
   'sessions','[]'::jsonb,'experiments','[]'::jsonb,'resources','[]'::jsonb);
 elsif p_action='observations.list' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(x.item) from (
   select to_jsonb(o)||jsonb_build_object('revision',to_jsonb(r),'decisions',coalesce((select jsonb_agg(jsonb_build_object('action',d.action,'note',d.note,'version',d.version,'created_at',d.created_at) order by d.created_at) from private.decisions d where d.observation_id=o.id),'[]'::jsonb)) item
   from private.observations o join private.revisions r on r.observation_id=o.id and r.version=o.current_revision
   where o.organisation_id=p_workspace and private.source_read(o.id) and private.entitled(p_workspace,r.offering_id)
   order by o.updated_at desc,o.id limit page_size offset page_no*page_size) x),'[]'::jsonb));
 elsif p_action='moderation.list' then
  if not private.cap(p_workspace,'learning.moderate') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(x.item) from (
   select jsonb_build_object('id',o.id,'state',o.state,'submitted_revision',o.submitted_revision,'revision',to_jsonb(r),
    'consent',jsonb_build_object('attribution',c.attribution),'reports',coalesce((select jsonb_agg(jsonb_build_object('id',rp.id,'publicationId',rp.publication_id,'reason',rp.reason,'state',rp.state)) from private.reports rp join private.publications pp on pp.id=rp.publication_id where pp.observation_id=o.id and rp.state='open'),'[]'::jsonb)) item
   from private.observations o join private.revisions r on r.observation_id=o.id and r.version=o.submitted_revision
   join private.consents c on c.observation_id=r.observation_id and c.version=r.version
   where o.state in ('submitted','clarification','rejected','published') and private.entitled(p_workspace,r.offering_id)
   order by o.updated_at,o.id limit page_size offset page_no*page_size)x),'[]'::jsonb));
 elsif p_action in ('learning.list','learning.recheck') then
  if not private.cap(p_workspace,'learning.read') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(x.item) from (
   select private.shared(p) item from private.publications p where private.publication_read(p.id,p_workspace)
   and (not(p_payload ? 'ids') or p.id in(select value::uuid from jsonb_array_elements_text(p_payload->'ids')))
   and (coalesce(p_payload->>'offeringId','')='' or p.offering_id=p_payload->>'offeringId')
   and (coalesce(p_payload->>'topic','')='' or p.topic=p_payload->>'topic')
   and (coalesce(p_payload->>'industry','')='' or p.industry=p_payload->>'industry')
   and (coalesce(p_payload->>'region','')='' or p.region=p_payload->>'region')
   and (coalesce(p_payload->>'periodStart','')='' or p.period_end >= (p_payload->>'periodStart')::date)
   and (coalesce(p_payload->>'periodEnd','')='' or p.period_start <= (p_payload->>'periodEnd')::date)
   and (coalesce(p_payload->>'query','')='' or to_tsvector('english',p.title||' '||p.body||' '||p.topic) @@ plainto_tsquery('english',left(p_payload->>'query',200)))
   order by p.published_at desc,p.id limit page_size offset page_no*page_size)x),'[]'::jsonb),'page',page_no,'pageSize',page_size);
 elsif p_action='themes.list' then
  if not private.cap(p_workspace,'learning.read') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- No geographic, industry or time breakdowns: avoid differencing-friendly cohort queries.
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('offeringId','page','pageSize')) then raise exception 'UNSAFE_BREAKDOWN' using errcode='22023'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(x.item) from (
   select jsonb_build_object('id',t.id,'title',t.title,'offeringId',t.offering_id,'organisations',count(distinct p.organisation_id),
    'evidence',jsonb_agg(private.shared(p)),'periodStart',min(p.period_start),'periodEnd',max(p.period_end),'updatedAt',max(p.published_at),
    'limitations','Small synthetic sample; contributing organisations are not market prevalence. No causal or anonymity guarantee.') item
   from private.themes t join private.publications p on p.offering_id=t.offering_id and p.topic=t.topic
   where private.publication_read(p.id,p_workspace) and (coalesce(p_payload->>'offeringId','')='' or t.offering_id=p_payload->>'offeringId')
   group by t.id having count(distinct p.organisation_id)>=3 order by t.id limit page_size offset page_no*page_size)x),'[]'::jsonb));
 elsif p_action='ideas.list' then
  if not private.cap(p_workspace,'learning.read') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(x.item) from (
   select jsonb_build_object('id',i.id,'title',i.title,'problem',i.problem,'offeringId',i.offering_id,'outcome',i.outcome,'team',i.team,'priority',i.priority,'status',i.status,'updatedAt',i.updated_at,
    'evidence',coalesce((select jsonb_agg(private.shared(p)) from private.idea_evidence e join private.publications p on p.id=e.publication_id where e.idea_id=i.id and private.publication_read(p.id,p_workspace)),'[]'::jsonb)) item
   from private.ideas i where private.entitled(p_workspace,i.offering_id)
   and exists(select 1 from private.idea_evidence e where e.idea_id=i.id and private.publication_read(e.publication_id,p_workspace))
   order by i.updated_at desc,i.id limit page_size offset page_no*page_size)x),'[]'::jsonb));
 elsif p_action='notifications.list' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select id,message,read_at,created_at from private.notifications where recipient_id=actor and organisation_id=p_workspace order by created_at desc,id limit page_size offset page_no*page_size)x),'[]'::jsonb));
 elsif p_action='members.list' then
  if not private.cap(p_workspace,'members.manage') or not exists(select 1 from private.organisations where id=p_workspace and kind='client') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'role',role,'approved',approved,'revokedAt',revoked_at)) from private.memberships where organisation_id=p_workspace),'[]'::jsonb),
   'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'intendedUserId',intended_user_id,'role',role,'expiresAt',expires_at,'acceptedAt',accepted_at)) from private.invitations where organisation_id=p_workspace),'[]'::jsonb));
 elsif p_action='sandbox.run' then
  if not private.cap(p_workspace,'sandbox.run') or not private.entitled(p_workspace,p_payload->>'offeringId') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('synthetic',true,'simulated',true,'message','Synthetic seasonal comparison: compare equivalent periods and explain seasonal context. This is not a credit or business decision.','inputs',jsonb_build_object('scenario','seasonal-sme','quarterlyValues',jsonb_build_array(80,120,160,100)));
 end if;
 -- Mutations are request-keyed and serialised per actor/workspace. Acknowledgements contain no source content.
 if p_action not in ('observations.save','observations.submit','observations.withdraw','moderation.decide','reports.create','reports.resolve','ideas.create','ideas.update','invitations.create','members.revoke','notifications.read') then raise exception 'UNKNOWN_ACTION' using errcode='22023'; end if;
 request_key:=(p_payload->>'requestId')::uuid;
 if request_key is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 select response into result from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=request_key;
 if found then return result; end if;
 target:=(p_payload->>'id')::uuid;
 if p_action like 'observations.%' or p_action='moderation.decide' then
  if p_action='observations.save' and target is null then
   if not private.cap(p_workspace,'observations.write') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   insert into private.observations(organisation_id,author_id) values(p_workspace,actor) returning * into obs;
   target:=obs.id;
  else
   select * into obs from private.observations where id=target for update;
   if not found then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  end if;
  if p_action<>'moderation.decide' and (obs.author_id<>actor or obs.organisation_id<>p_workspace or not private.cap(p_workspace,'observations.write')) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  if p_action='observations.save' then
   if obs.state not in ('draft','clarification','rejected','published') then raise exception 'INVALID_TRANSITION' using errcode='23514'; end if;
   if exists(select 1 from private.revisions where observation_id=target) then
    if coalesce((p_payload->>'expectedRevision')::integer,0)<>obs.current_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
    version_no:=obs.current_revision+1;
   else version_no:=1; end if;
   if not coalesce((p_payload->'consent'->>'processing')::boolean,false) then raise exception 'PROCESSING_CONSENT_REQUIRED' using errcode='23514'; end if;
   if not private.entitled(p_workspace,p_payload->>'offeringId') then raise exception 'ENTITLEMENT_DENIED' using errcode='42501'; end if;
   insert into private.revisions(observation_id,version,title,body,offering_id,topic,industry,region,period_start,period_end,evidence_type,confidence,evidence_url)
    values(target,version_no,p_payload->>'title',p_payload->>'body',p_payload->>'offeringId',p_payload->>'topic',p_payload->>'industry',p_payload->>'region',
    (p_payload->>'periodStart')::date,(p_payload->>'periodEnd')::date,p_payload->>'evidenceType',p_payload->>'confidence',nullif(p_payload->>'evidenceUrl',''));
   insert into private.consents(observation_id,version,processing,publication,attribution,training,actor_id) values(target,version_no,true,
    coalesce((p_payload->'consent'->>'publication')::boolean,false),coalesce((p_payload->'consent'->>'attribution')::boolean,false),coalesce((p_payload->'consent'->>'training')::boolean,false),actor);
   -- A material edit immediately removes the old shared copy; a new review is necessary.
   update private.publications set available=false where observation_id=target;
   update private.observations set current_revision=version_no,state='draft',source_audience=coalesce(p_payload->>'audience','private'),updated_at=now() where id=target;
   result:=jsonb_build_object('id',target,'revision',version_no,'state','draft');
  elsif p_action='observations.submit' then
   if obs.state not in ('draft','clarification','rejected') or coalesce((p_payload->>'expectedRevision')::integer,0)<>obs.current_revision then raise exception 'INVALID_TRANSITION' using errcode='23514'; end if;
   select * into rev from private.revisions where observation_id=target and version=obs.current_revision;
   if not private.entitled(p_workspace,rev.offering_id) then raise exception 'ENTITLEMENT_DENIED' using errcode='42501'; end if;
   if not exists(select 1 from private.consents where observation_id=target and version=obs.current_revision and processing and publication) then raise exception 'PUBLICATION_CONSENT_REQUIRED' using errcode='23514'; end if;
   update private.observations set state='submitted',submitted_revision=current_revision,updated_at=now() where id=target;
   result:=jsonb_build_object('id',target,'revision',obs.current_revision,'state','submitted');
  elsif p_action='observations.withdraw' then
   update private.publications set available=false where observation_id=target;
   update private.observations set state='withdrawn',updated_at=now() where id=target;
   result:=jsonb_build_object('id',target,'state','withdrawn');
  else
   if not private.cap(p_workspace,'learning.moderate') or obs.state not in ('submitted','published') or (p_payload->>'expectedRevision')::integer is distinct from obs.submitted_revision then raise exception 'REVIEW_DENIED' using errcode='42501'; end if;
   select * into rev from private.revisions where observation_id=target and version=obs.submitted_revision;
   if not private.entitled(p_workspace,rev.offering_id) then raise exception 'ENTITLEMENT_DENIED' using errcode='42501'; end if;
   note_text:=p_payload->>'note';
   if p_payload->>'decision' in ('clarify','reject') and obs.state='submitted' then
    update private.observations set state=case when p_payload->>'decision'='clarify' then 'clarification' else 'rejected' end,updated_at=now() where id=target;
   elsif p_payload->>'decision'='publish' and obs.state='submitted' then
    if not exists(select 1 from private.consents where observation_id=target and version=rev.version and processing and publication) then raise exception 'CONSENT_DENIED' using errcode='42501'; end if;
    if nullif(p_payload->>'attribution','') is not null and not exists(select 1 from private.consents where observation_id=target and version=rev.version and attribution) then raise exception 'ATTRIBUTION_DENIED' using errcode='42501'; end if;
    update private.publications set available=false where observation_id=target;
    insert into private.publications(observation_id,version,organisation_id,title,body,offering_id,topic,industry,region,period_start,period_end,evidence_type,confidence,attribution)
    values(target,rev.version,obs.organisation_id,p_payload->>'title',p_payload->>'body',rev.offering_id,p_payload->>'topic',p_payload->>'industry',p_payload->>'region',
    (p_payload->>'periodStart')::date,(p_payload->>'periodEnd')::date,rev.evidence_type,rev.confidence,nullif(p_payload->>'attribution','')) returning id into new_id;
    update private.observations set state='published',updated_at=now() where id=target;
   elsif p_payload->>'decision'='suspend' and obs.state='published' then
    update private.publications set available=false where observation_id=target;
   else raise exception 'INVALID_TRANSITION' using errcode='23514'; end if;
   insert into private.decisions(observation_id,version,actor_id,action,note) values(target,rev.version,actor,p_payload->>'decision',note_text);
   insert into private.notifications(recipient_id,organisation_id,message) values(obs.author_id,obs.organisation_id,'Your observation review status changed. Open your observations for details.');
   result:=jsonb_build_object('id',target,'publicationId',new_id,'ok',true);
  end if;
 elsif p_action='reports.create' then
  if not private.cap(p_workspace,'learning.report') or not private.publication_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  insert into private.reports(publication_id,reporter_id,reason) values(target,actor,p_payload->>'reason') on conflict(publication_id,reporter_id) do nothing;
  result:=jsonb_build_object('ok',true);
 elsif p_action='reports.resolve' then
  if not private.cap(p_workspace,'learning.moderate') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select p.* into pub from private.reports rp join private.publications p on p.id=rp.publication_id where rp.id=target for update of rp,p;
  if not found or not private.entitled(p_workspace,pub.offering_id) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  select * into obs from private.observations where id=pub.observation_id for update;
  if obs.state='withdrawn' or obs.current_revision<>pub.version then raise exception 'RESTORE_DENIED' using errcode='23514'; end if;
  if not coalesce((p_payload->>'restore')::boolean,false) then update private.publications set available=false where id=pub.id;
  else update private.publications set available=true where id=pub.id; end if;
  update private.reports set state='resolved',resolution=p_payload->>'note' where id=target;
  insert into private.decisions(observation_id,version,actor_id,action,note) values(obs.id,pub.version,actor,'resolve',p_payload->>'note');
  insert into private.notifications(recipient_id,organisation_id,message) values(obs.author_id,obs.organisation_id,'A contribution report was resolved. Open your observations for the recorded decision.');
  result:=jsonb_build_object('ok',true);
 elsif p_action in ('ideas.create','ideas.update') then
  if not private.cap(p_workspace,'ideas.write') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_action='ideas.create' then
   if not private.entitled(p_workspace,p_payload->>'offeringId') or not exists(select 1 from private.owner_assignments where organisation_id=p_workspace and user_id=actor and offering_id=p_payload->>'offeringId') then raise exception 'OWNER_ASSIGNMENT_REQUIRED' using errcode='42501'; end if;
   if jsonb_array_length(coalesce(p_payload->'evidence','[]')) not between 1 and 20 then raise exception 'EVIDENCE_REQUIRED' using errcode='23514'; end if;
   for evidence_id in select value::uuid from jsonb_array_elements_text(p_payload->'evidence') loop
    if not private.publication_read(evidence_id,p_workspace) or not exists(select 1 from private.publications where id=evidence_id and offering_id=p_payload->>'offeringId') then raise exception 'EVIDENCE_DENIED' using errcode='42501'; end if;
   end loop;
   insert into private.ideas(title,problem,offering_id,outcome,owner_id,owner_workspace,team,priority) values(p_payload->>'title',p_payload->>'problem',p_payload->>'offeringId',p_payload->>'outcome',actor,p_workspace,p_payload->>'team',p_payload->>'priority') returning id into target;
   insert into private.idea_evidence select target,value::uuid from jsonb_array_elements_text(p_payload->'evidence') on conflict do nothing;
  else
   select * into idea from private.ideas where id=target for update;
   if not found or idea.owner_id<>actor or idea.owner_workspace<>p_workspace or not private.entitled(p_workspace,idea.offering_id) or not exists(select 1 from private.owner_assignments where organisation_id=p_workspace and user_id=actor and offering_id=idea.offering_id) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
   update private.ideas set status=p_payload->>'status',updated_at=now() where id=target;
   -- Generic status notification; it contains no title, excerpt, evidence or internal delivery promises.
   insert into private.notifications(recipient_id,organisation_id,message)
   select distinct o.author_id,o.organisation_id,'An improvement idea linked to your shared contribution has a status update.'
   from private.idea_evidence e join private.publications p on p.id=e.publication_id join private.observations o on o.id=p.observation_id
   where e.idea_id=target and p.available and o.state<>'withdrawn';
  end if;
  result:=jsonb_build_object('id',target,'ok',true);
 elsif p_action='invitations.create' then
  if not private.cap(p_workspace,'members.manage') or not exists(select 1 from private.memberships m join private.organisations o on o.id=m.organisation_id where m.organisation_id=p_workspace and m.user_id=actor and m.role='client_admin' and o.kind='client') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- Client administrators can invite approved client members only; admin provisioning is organiser controlled.
  chosen_role:=p_payload->>'role';
  if chosen_role<>'client_member' then raise exception 'ROLE_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=(p_payload->>'intendedUserId')::uuid and email_confirmed_at is not null) then raise exception 'ACCOUNT_DENIED' using errcode='42501'; end if;
  insert into private.invitations(organisation_id,intended_user_id,role,expires_at,created_by) values(p_workspace,(p_payload->>'intendedUserId')::uuid,chosen_role,now()+interval '48 hours',actor) returning id into target;
  result:=jsonb_build_object('id',target,'stored',true,'emailSent',false);
 elsif p_action='members.revoke' then
  if not private.cap(p_workspace,'members.manage') or target=actor or not exists(select 1 from private.memberships where organisation_id=p_workspace and user_id=actor and role='client_admin') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  update private.memberships set revoked_at=now() where organisation_id=p_workspace and user_id=target and role='client_member';
  if not found then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  result:=jsonb_build_object('ok',true);
 elsif p_action='notifications.read' then
  update private.notifications set read_at=coalesce(read_at,now()) where id=target and organisation_id=p_workspace and recipient_id=actor;
  if not found then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
  result:=jsonb_build_object('ok',true);
 end if;
 insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,p_workspace,p_action,target);
 insert into private.requests(actor_id,workspace_id,action,key,response) values(actor,p_workspace,p_action,request_key,result);
 return result;
end $$;
revoke all on function public.portal(text,uuid,jsonb) from public,anon;
grant execute on function public.portal(text,uuid,jsonb) to authenticated;

create function public.enquire(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p_payload->>'email'),0));
 if exists(select 1 from private.enquiries where key=(p_payload->>'requestId')::uuid) then return jsonb_build_object('stored',true,'emailSent',false); end if;
 if (select count(*) from private.enquiries where email=lower(p_payload->>'email') and created_at>now()-interval '1 day')>=5 then raise exception 'RATE_LIMITED' using errcode='54000'; end if;
 insert into private.enquiries(key,email,name,kind,message) values((p_payload->>'requestId')::uuid,lower(p_payload->>'email'),p_payload->>'name',p_payload->>'kind',p_payload->>'message') returning id into new_id;
 return jsonb_build_object('stored',true,'emailSent',false);
end $$;
revoke all on function public.enquire(jsonb) from public;
grant execute on function public.enquire(jsonb) to anon,authenticated;
commit;
