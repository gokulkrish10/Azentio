-- Additive learning tools. Apply once after 001 and 002; no hosted reset.
begin;
-- Direct RLS/Storage reads need the same non-anonymous identity boundary as RPCs.
create or replace function private.member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memberships m join private.organisations o on o.id=m.organisation_id join auth.users u on u.id=m.user_id
 where m.organisation_id=p_org and m.user_id=auth.uid() and m.approved and m.revoked_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (o.kind='client' and m.role in ('client_member','client_admin') or o.kind='employee' and m.role='employee' and m.work_identity_verified and lower(u.email) like '%@azentio.com'))
$$;
alter table private.revisions add column category text not null default 'market_observation'
 check(category in ('market_observation','emerging_trend','product_gap','operational_challenge','successful_practice','improvement_suggestion'));

create table private.learning_settings (
 singleton boolean primary key default true check(singleton),
 minimum_organisations integer not null default 3 check(minimum_organisations between 3 and 100)
);
insert into private.learning_settings values(true,3);
create table private.workspace_acknowledgements (
 user_id uuid references auth.users, workspace_id uuid references private.organisations,
 version text not null, acknowledged_at timestamptz not null default now(), primary key(user_id,workspace_id)
);
create table private.bookmarks (
 user_id uuid references auth.users, workspace_id uuid references private.organisations,
 publication_id uuid references private.publications, created_at timestamptz not null default now(),
 primary key(user_id,workspace_id,publication_id)
);
create table private.saved_searches (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
 workspace_id uuid not null references private.organisations, name text not null check(length(name) between 1 and 80),
 filters jsonb not null check(jsonb_typeof(filters)='object' and octet_length(filters::text)<=1600),
 created_at timestamptz not null default now()
);
create table private.learning_comments (
 id uuid primary key default gen_random_uuid(), publication_id uuid not null references private.publications,
 author_id uuid not null references auth.users, workspace_id uuid not null references private.organisations,
 body text not null check(length(body) between 5 and 2000), reviewed_body text check(length(reviewed_body) between 5 and 2000),
 publication_consent boolean not null check(publication_consent),
 state text not null default 'pending' check(state in ('pending','published','rejected','withdrawn')),
 decision_note text check(length(decision_note) between 1 and 1000), reviewer_id uuid references auth.users,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index learning_comments_parent on private.learning_comments(publication_id,created_at);
create table private.comment_reports (
 id uuid primary key default gen_random_uuid(), comment_id uuid not null references private.learning_comments,
 reporter_id uuid not null references auth.users, reason text not null check(length(reason) between 5 and 1000),
 resolved boolean not null default false, unique(comment_id,reporter_id)
);
create table private.contribution_feedback (
 user_id uuid references auth.users, workspace_id uuid references private.organisations,
 publication_id uuid references private.publications,
 assessment text not null check(assessment in ('useful','needs_evidence')),
 primary key(user_id,workspace_id,publication_id)
);
create table private.evidence_assessments (
 publication_id uuid primary key references private.publications, reviewer_id uuid not null references auth.users,
 quality text not null check(quality in ('strong','limited','needs_evidence')),
 reason text not null check(length(reason) between 5 and 1000), updated_at timestamptz not null default now()
);
create table private.sandbox_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
 workspace_id uuid not null references private.organisations, offering_id text not null references private.offerings,
 name text not null check(length(name) between 1 and 120), result jsonb not null,
 rating text check(rating in ('useful','needs_context')), feedback text check(length(feedback)<=1000),
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['learning_settings','workspace_acknowledgements','bookmarks','saved_searches','learning_comments','comment_reports','contribution_feedback','evidence_assessments','sandbox_runs'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Preserve the audited original workflow behind the same public RPC signature.
alter function public.portal(text,uuid,jsonb) rename to portal_core;
alter function public.portal_core(text,uuid,jsonb) set schema private;
revoke all on function private.portal_core(text,uuid,jsonb) from public,anon,authenticated;

create function public.portal(p_action text,p_workspace uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; request_key uuid; target uuid; record private.learning_comments;
 run private.sandbox_runs; pub uuid; search_filters jsonb; k text; v text; threshold integer; category_value text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
 raise exception 'SIGN_IN_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- The original workspaces and account-bound invitation acceptance keep their original gates.
 if p_action in ('workspaces','invitations.accept') then return private.portal_core(p_action,p_workspace,p_payload); end if;
 perform 1 from private.memberships where organisation_id=p_workspace and user_id=actor for share;
 if not private.member(p_workspace) then raise exception 'WORKSPACE_DENIED' using errcode='42501'; end if;

 if p_action='dashboard' then
 result:=private.portal_core(p_action,p_workspace,p_payload);
 return result||jsonb_build_object('onboarding',jsonb_build_object('version','sharing-v1','acknowledged',exists(select 1 from private.workspace_acknowledgements where user_id=actor and workspace_id=p_workspace and version='sharing-v1')));
 elsif p_action='observations.save' then
 if not exists(select 1 from private.workspace_acknowledgements where user_id=actor and workspace_id=p_workspace and version='sharing-v1') then raise exception 'ONBOARDING_REQUIRED' using errcode='22023'; end if;
 category_value:=coalesce(p_payload->>'category','market_observation');
 if category_value not in ('market_observation','emerging_trend','product_gap','operational_challenge','successful_practice','improvement_suggestion') then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
 -- Replayed writes must not change the original revision's category.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 if exists(select 1 from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=(p_payload->>'requestId')::uuid) then
 return private.portal_core(p_action,p_workspace,p_payload-'category'); end if;
 result:=private.portal_core(p_action,p_workspace,p_payload-'category');
 update private.revisions set category=category_value where observation_id=(result->>'id')::uuid and version=(result->>'revision')::integer;
 return result;
 elsif p_action='themes.list' then
 select minimum_organisations into threshold from private.learning_settings where singleton;
 result:=private.portal_core(p_action,p_workspace,p_payload);
 -- Apply suppression before pagination; filtered early pages must not hide later eligible themes.
 return jsonb_build_object('minimumOrganisations',threshold,'items',coalesce((select jsonb_agg(x.item) from (
 select jsonb_build_object('id',t.id,'title',t.title,'offeringId',t.offering_id,'organisations',count(distinct p.organisation_id),
 'evidence',jsonb_agg(private.shared(p)),'periodStart',min(p.period_start),'periodEnd',max(p.period_end),'updatedAt',max(p.published_at),
 'limitations','Small synthetic sample; contributing organisations are not market prevalence. No causal or anonymity guarantee.') item
 from private.themes t join private.publications p on p.offering_id=t.offering_id and p.topic=t.topic
 join private.organisations source_org on source_org.id=p.organisation_id and source_org.kind='client' and source_org.synthetic
 where private.publication_read(p.id,p_workspace) and (coalesce(p_payload->>'offeringId','')='' or t.offering_id=p_payload->>'offeringId')
 group by t.id having count(distinct p.organisation_id)>=threshold order by t.id
 limit coalesce((p_payload->>'pageSize')::integer,20) offset coalesce((p_payload->>'page')::integer,0)*coalesce((p_payload->>'pageSize')::integer,20))x),'[]'::jsonb));
 end if;

 if p_action='onboarding.acknowledge' then
 if p_payload->>'version' is distinct from 'sharing-v1' or p_payload->>'understood' is distinct from 'true' then raise exception 'INVALID_ACKNOWLEDGEMENT' using errcode='22023'; end if;
 elsif p_action='learning.configure' then
 if not private.cap(p_workspace,'portal.admin') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 elsif p_action like 'sandbox.%' and p_action<>'sandbox.run' then
 if not private.cap(p_workspace,'sandbox.run') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 elsif p_action in ('bookmarks.list','bookmarks.set','searches.list','searches.save','searches.delete','comments.list','comments.create','comments.withdraw','comments.report','comments.review','comments.queue','feedback.set','quality.set','quality.get') then
 if not private.cap(p_workspace,'learning.read') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 else return private.portal_core(p_action,p_workspace,p_payload);
 end if;

 -- Bounded reads return only currently eligible parent resources.
 if p_action='bookmarks.list' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(private.shared(p) order by b.created_at desc) from private.bookmarks b join private.publications p on p.id=b.publication_id where b.user_id=actor and b.workspace_id=p_workspace and private.publication_read(p.id,p_workspace)),'[]'::jsonb));
 elsif p_action='searches.list' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'filters',filters) order by created_at desc) from private.saved_searches where user_id=actor and workspace_id=p_workspace),'[]'::jsonb));
 elsif p_action='sandbox.runs' then
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select s.id,s.name,s.offering_id as "offeringId",s.result,s.rating,s.feedback,s.created_at from private.sandbox_runs s where s.user_id=actor and s.workspace_id=p_workspace and private.entitled(p_workspace,s.offering_id) order by s.created_at desc limit 50)x),'[]'::jsonb));
 elsif p_action='comments.queue' then
 if not private.cap(p_workspace,'learning.moderate') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (select c.id,c.publication_id as "publicationId",p.title as "publicationTitle",c.body,c.state,c.created_at,coalesce((select jsonb_agg(r.reason) from private.comment_reports r where r.comment_id=c.id and not r.resolved),'[]'::jsonb) as reports from private.learning_comments c join private.publications p on p.id=c.publication_id where c.state in ('pending','published') and private.publication_read(p.id,p_workspace) order by c.created_at limit 50)x),'[]'::jsonb));
 elsif p_action in ('comments.list','quality.get') then
 target:=(p_payload->>'id')::uuid;
 if not private.publication_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if p_action='quality.get' then
 return jsonb_build_object('assessment',(select jsonb_build_object('quality',quality,'reason',reason,'updatedAt',updated_at) from private.evidence_assessments where publication_id=target),'yourFeedback',(select assessment from private.contribution_feedback where publication_id=target and user_id=actor and workspace_id=p_workspace)); end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'body',case when c.author_id=actor and c.workspace_id=p_workspace then c.body else c.reviewed_body end,'state',c.state,'own',c.author_id=actor and c.workspace_id=p_workspace,'decision',case when c.author_id=actor and c.workspace_id=p_workspace then c.decision_note else null end,'createdAt',c.created_at) order by c.created_at) from (select * from private.learning_comments where publication_id=target and (state='published' or author_id=actor and workspace_id=p_workspace) and state<>'withdrawn' order by created_at desc limit 50)c),'[]'::jsonb));
 end if;

 request_key:=(p_payload->>'requestId')::uuid;
 if request_key is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_workspace::text,0));
 select response into result from private.requests where actor_id=actor and workspace_id=p_workspace and action=p_action and key=request_key;
 if found then return result; end if;
 target:=(p_payload->>'id')::uuid;
 result:=jsonb_build_object('ok',true);
 if p_action='onboarding.acknowledge' then
 insert into private.workspace_acknowledgements(user_id,workspace_id,version) values(actor,p_workspace,'sharing-v1') on conflict(user_id,workspace_id) do update set version=excluded.version,acknowledged_at=now();
 elsif p_action='learning.configure' then
 update private.learning_settings set minimum_organisations=(p_payload->>'minimumOrganisations')::integer where singleton;
 elsif p_action='bookmarks.set' then
 if jsonb_typeof(p_payload->'saved') is distinct from 'boolean' then raise exception 'INVALID_BOOKMARK' using errcode='22023'; end if;
 if not private.publication_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if p_payload->>'saved'='true' then
 if (select count(*) from private.bookmarks where user_id=actor and workspace_id=p_workspace)>=100 and not exists(select 1 from private.bookmarks where user_id=actor and workspace_id=p_workspace and publication_id=target) then raise exception 'BOOKMARK_LIMIT' using errcode='22023'; end if;
 insert into private.bookmarks values(actor,p_workspace,target,now()) on conflict do nothing;
 else delete from private.bookmarks where user_id=actor and workspace_id=p_workspace and publication_id=target; end if;
 elsif p_action='searches.save' then
 if (select count(*) from private.saved_searches where user_id=actor and workspace_id=p_workspace)>=30 then raise exception 'SEARCH_LIMIT' using errcode='22023'; end if;
 search_filters:=p_payload->'filters';
 if jsonb_typeof(search_filters) is distinct from 'object' then raise exception 'INVALID_FILTERS' using errcode='22023'; end if;
 for k,v in select * from jsonb_each_text(search_filters) loop
 if k not in ('query','offeringId','topic','industry','region','periodStart','periodEnd') or jsonb_typeof(search_filters->k) is distinct from 'string' or v is null or length(v)>200 then raise exception 'INVALID_FILTERS' using errcode='22023'; end if;
 if k='offeringId' and not private.entitled(p_workspace,v) then raise exception 'OFFERING_DENIED' using errcode='42501'; end if;
 if k in ('periodStart','periodEnd') then perform v::date; end if;
 end loop;
 insert into private.saved_searches(user_id,workspace_id,name,filters) values(actor,p_workspace,btrim(p_payload->>'name'),search_filters) returning id into target;
 result:=jsonb_build_object('ok',true,'id',target);
 elsif p_action='searches.delete' then
 delete from private.saved_searches where id=target and user_id=actor and workspace_id=p_workspace;
 if not found then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 elsif p_action='sandbox.save' then
 if p_payload->>'offeringId'<>'financial-analysis-intelligence' then raise exception 'SCENARIO_UNAVAILABLE' using errcode='22023'; end if;
 result:=private.portal_core('sandbox.run',p_workspace,jsonb_build_object('offeringId',p_payload->>'offeringId','scenario','seasonal-sme'));
 insert into private.sandbox_runs(user_id,workspace_id,offering_id,name,result) values(actor,p_workspace,p_payload->>'offeringId',btrim(p_payload->>'name'),result) returning id into target;
 result:=jsonb_build_object('ok',true,'id',target);
 elsif p_action='sandbox.feedback' then
 if p_payload->>'rating' is null or p_payload->>'rating' not in ('useful','needs_context') then raise exception 'INVALID_FEEDBACK' using errcode='22023'; end if;
 select * into run from private.sandbox_runs where id=target for update;
 if not found or run.user_id<>actor or run.workspace_id<>p_workspace or not private.entitled(p_workspace,run.offering_id) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 update private.sandbox_runs set rating=p_payload->>'rating',feedback=btrim(p_payload->>'feedback') where id=target;
 elsif p_action='comments.create' then
 if not private.cap(p_workspace,'observations.write') or not private.publication_read(target,p_workspace) or p_payload->>'publicationConsent' is distinct from 'true' then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if (select count(*) from private.learning_comments where author_id=actor and created_at>now()-interval '1 day')>=30 then raise exception 'COMMENT_LIMIT' using errcode='22023'; end if;
 insert into private.learning_comments(publication_id,author_id,workspace_id,body,publication_consent) values(target,actor,p_workspace,btrim(p_payload->>'body'),true) returning id into target;
 result:=jsonb_build_object('ok',true,'id',target);
 elsif p_action in ('comments.withdraw','comments.review','comments.report') then
 select * into record from private.learning_comments where id=target for update;
 if not found then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if p_action='comments.report' then
 if not private.cap(p_workspace,'learning.report') or not private.publication_read(record.publication_id,p_workspace) or record.state<>'published' then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 insert into private.comment_reports(comment_id,reporter_id,reason) values(target,actor,btrim(p_payload->>'reason'));
 update private.learning_comments set state='pending',updated_at=now() where id=target;
 elsif p_action='comments.withdraw' then
 if record.author_id<>actor or record.workspace_id<>p_workspace then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 update private.learning_comments set state='withdrawn',updated_at=now() where id=target;
 else
 if not private.cap(p_workspace,'learning.moderate') or not private.publication_read(record.publication_id,p_workspace) or record.state='withdrawn' then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 if length(btrim(coalesce(p_payload->>'note',''))) not between 1 and 1000 then raise exception 'DECISION_REASON_REQUIRED' using errcode='22023'; end if;
 if p_payload->>'decision' not in ('publish','reject') then raise exception 'INVALID_DECISION' using errcode='22023'; end if;
 if p_payload->>'decision'='publish' and length(btrim(coalesce(p_payload->>'body',''))) not between 5 and 2000 then raise exception 'REVIEWED_BODY_REQUIRED' using errcode='22023'; end if;
 update private.learning_comments set state=case when p_payload->>'decision'='publish' then 'published' else 'rejected' end,reviewed_body=case when p_payload->>'decision'='publish' then btrim(p_payload->>'body') else null end,decision_note=p_payload->>'note',reviewer_id=actor,updated_at=now() where id=target;
 update private.comment_reports set resolved=true where comment_id=target and not resolved;
 insert into private.notifications(recipient_id,organisation_id,message) values(record.author_id,record.workspace_id,'Your comment review status changed. Open shared learning for details.');
 end if;
 elsif p_action='feedback.set' then
 if not private.publication_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 insert into private.contribution_feedback values(actor,p_workspace,target,p_payload->>'assessment') on conflict(user_id,workspace_id,publication_id) do update set assessment=excluded.assessment;
 elsif p_action='quality.set' then
 if not private.cap(p_workspace,'learning.moderate') or not private.publication_read(target,p_workspace) then raise exception 'RESOURCE_DENIED' using errcode='42501'; end if;
 insert into private.evidence_assessments values(target,actor,p_payload->>'quality',btrim(p_payload->>'reason'),now()) on conflict(publication_id) do update set quality=excluded.quality,reason=excluded.reason,reviewer_id=actor,updated_at=now();
 else raise exception 'UNKNOWN_ACTION' using errcode='22023'; end if;
 insert into private.audit_events(actor_id,organisation_id,action,resource_id) values(actor,p_workspace,p_action,target);
 insert into private.requests values(actor,p_workspace,p_action,request_key,result);
 return result;
end $$;
revoke all on function public.portal(text,uuid,jsonb) from public,anon;
grant execute on function public.portal(text,uuid,jsonb) to authenticated;
commit;
