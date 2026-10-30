-- One database. Only allowlisted RPCs are exposed to PostgREST.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.organisations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 kind text not null check(kind in ('client','employee')), synthetic boolean not null default true
);
create table private.memberships (
 organisation_id uuid references private.organisations on delete restrict, user_id uuid references auth.users on delete restrict,
 role text not null check(role in ('client_member','client_admin','employee')), approved boolean not null default false,
 revoked_at timestamptz, work_identity_verified boolean not null default false,
 primary key(organisation_id,user_id)
);
create table private.role_grants (
 organisation_id uuid, user_id uuid, capability text not null check(capability in
 ('observations.write','learning.read','learning.report','learning.moderate','content.publish','broadcast.publish','members.manage','portal.admin','ideas.write','sandbox.run')),
 primary key(organisation_id,user_id,capability), foreign key(organisation_id,user_id) references private.memberships on delete cascade
);
create table private.offerings (id text primary key check(id ~ '^[a-z0-9-]{1,60}$'), title text not null);
create table private.entitlements (
 organisation_id uuid references private.organisations, offering_id text references private.offerings,
 enabled boolean not null default true, primary key(organisation_id,offering_id)
);
create table private.owner_assignments (
 organisation_id uuid, user_id uuid, offering_id text references private.offerings,
 primary key(organisation_id,user_id,offering_id), foreign key(organisation_id,user_id) references private.memberships
);
create table private.observations (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references private.organisations,
 author_id uuid not null references auth.users, source_audience text not null default 'private' check(source_audience in ('private','organisation')),
 state text not null default 'draft' check(state in ('draft','submitted','clarification','rejected','published','withdrawn')),
 current_revision integer not null default 1, submitted_revision integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.revisions (
 observation_id uuid references private.observations, version integer not null check(version>0),
 title text not null check(length(title) between 5 and 160), body text not null check(length(body) between 20 and 6000),
 offering_id text not null references private.offerings, topic text not null check(length(topic) between 1 and 80),
 industry text not null check(length(industry) between 1 and 80), region text not null check(length(region) between 1 and 80),
 period_start date not null, period_end date not null check(period_end>=period_start),
 evidence_type text not null check(evidence_type in ('synthetic scenario','operational observation','research summary')),
 confidence text not null check(confidence in ('low','medium','high')),
 evidence_url text check(evidence_url is null or (length(evidence_url)<=1000 and evidence_url ~ '^https://[^ /]+(/|$)')),
 created_at timestamptz not null default now(), primary key(observation_id,version)
);
alter table private.observations add constraint submitted_revision_fk foreign key(id,submitted_revision) references private.revisions(observation_id,version) deferrable initially deferred;
create table private.consents (
 id uuid primary key default gen_random_uuid(), observation_id uuid not null, version integer not null,
 processing boolean not null, publication boolean not null default false, attribution boolean not null default false, training boolean not null default false,
 actor_id uuid not null references auth.users, created_at timestamptz not null default now(),
 foreign key(observation_id,version) references private.revisions, unique(observation_id,version)
);
create table private.decisions (
 id uuid primary key default gen_random_uuid(), observation_id uuid not null, version integer not null,
 actor_id uuid not null references auth.users, action text not null check(action in ('clarify','reject','publish','suspend','restore','resolve')),
 note text not null check(length(note) between 1 and 2000), created_at timestamptz not null default now(),
 foreign key(observation_id,version) references private.revisions
);
create table private.publications (
 id uuid primary key default gen_random_uuid(), observation_id uuid not null, version integer not null,
 organisation_id uuid not null references private.organisations, available boolean not null default true,
 title text not null check(length(title) between 5 and 160), body text not null check(length(body) between 20 and 6000),
 offering_id text not null references private.offerings, topic text not null check(length(topic) between 1 and 80),
 industry text not null check(length(industry) between 1 and 80), region text not null check(length(region) between 1 and 80),
 period_start date not null, period_end date not null check(period_end>=period_start), evidence_type text not null,
 confidence text not null check(confidence in ('low','medium','high')), attribution text check(length(attribution)<=120),
 published_at timestamptz not null default now(), foreign key(observation_id,version) references private.revisions,
 unique(observation_id,version)
);
create unique index one_available_publication on private.publications(observation_id) where available;
create index publication_search on private.publications using gin(to_tsvector('english',title || ' ' || body || ' ' || topic));
create table private.reports (
 id uuid primary key default gen_random_uuid(), publication_id uuid not null references private.publications,
 reporter_id uuid not null references auth.users, reason text not null check(length(reason) between 5 and 2000),
 state text not null default 'open' check(state in ('open','resolved')), resolution text check(length(resolution)<=2000),
 created_at timestamptz not null default now(), unique(publication_id,reporter_id)
);
create table private.themes (id text primary key, title text not null, offering_id text not null references private.offerings, topic text not null);
create table private.ideas (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 5 and 160),
 problem text not null check(length(problem) between 20 and 3000), offering_id text not null references private.offerings,
 outcome text not null check(length(outcome) between 10 and 2000), owner_id uuid not null references auth.users,
 owner_workspace uuid not null references private.organisations, team text not null check(length(team) between 1 and 120),
 priority text not null check(priority in ('low','medium','high')),
 status text not null default 'Proposed' check(status in ('Proposed','Under review','Planned','In progress','Released','Not proceeding')),
 updated_at timestamptz not null default now()
);
create table private.idea_evidence (idea_id uuid references private.ideas, publication_id uuid references private.publications, primary key(idea_id,publication_id));
create table private.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users, organisation_id uuid not null references private.organisations,
 message text not null check(length(message)<=300), read_at timestamptz, created_at timestamptz not null default now()
);
create table private.audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users, organisation_id uuid references private.organisations,
 action text not null, resource_id uuid, created_at timestamptz not null default now()
);
create table private.invitations (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references private.organisations,
 intended_user_id uuid not null references auth.users, role text not null check(role in ('client_member','client_admin')),
 expires_at timestamptz not null, accepted_at timestamptz, created_by uuid not null references auth.users,
 unique(organisation_id,intended_user_id)
);
create table private.requests (
 actor_id uuid references auth.users, workspace_id uuid references private.organisations, action text, key uuid,
 response jsonb not null, primary key(actor_id,workspace_id,action,key)
);
create table private.enquiries (
 id uuid primary key default gen_random_uuid(), key uuid not null unique, email text not null check(length(email)<=254 and email ~ '^[^ @]+@[^ @]+\.[^ @]+$'),
 name text not null check(length(name) between 1 and 120), kind text not null check(kind in ('demo','event')),
 message text not null check(length(message) between 5 and 2000), created_at timestamptz not null default now()
);

-- No trusted email claims from user metadata. Membership approval is always current.
create function private.member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memberships m join private.organisations o on o.id=m.organisation_id join auth.users u on u.id=m.user_id
 where m.organisation_id=p_org and m.user_id=auth.uid() and m.approved and m.revoked_at is null and u.email_confirmed_at is not null
 and (o.kind='client' and m.role in ('client_member','client_admin') or o.kind='employee' and m.role='employee' and m.work_identity_verified and lower(u.email) like '%@azentio.com'))
$$;
create function private.cap(p_org uuid,p_cap text) returns boolean language sql stable security definer set search_path='' as $$
 select private.member(p_org) and exists(select 1 from private.role_grants g where g.organisation_id=p_org and g.user_id=auth.uid() and g.capability=p_cap)
 and (p_cap not in ('learning.moderate','content.publish','broadcast.publish','portal.admin','ideas.write') or exists(select 1 from private.organisations o where o.id=p_org and o.kind='employee'))
$$;
create function private.entitled(p_org uuid,p_offering text) returns boolean language sql stable security definer set search_path='' as $$
 select private.member(p_org) and exists(select 1 from private.entitlements e where e.organisation_id=p_org and e.offering_id=p_offering and e.enabled)
$$;
create function private.source_read(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.observations o join private.revisions r on r.observation_id=o.id and r.version=o.current_revision where o.id=p_id and private.member(o.organisation_id) and private.entitled(o.organisation_id,r.offering_id) and (o.author_id=auth.uid() or o.source_audience='organisation'))
$$;
create function private.publication_read(p_id uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.cap(p_org,'learning.read') and exists(select 1 from private.publications p join private.observations o on o.id=p.observation_id
 where p.id=p_id and p.available and o.state<>'withdrawn' and private.entitled(p_org,p.offering_id))
$$;
create function private.shared(p private.publications) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'offeringId',p.offering_id,'topic',p.topic,'industry',p.industry,'region',p.region,
 'periodStart',p.period_start,'periodEnd',p.period_end,'evidenceType',p.evidence_type,'confidence',p.confidence,'attribution',p.attribution,'publishedAt',p.published_at)
$$;

-- Defense in depth. There are no direct write grants. Sensitive internal tables default deny.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='private' loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public, anon, authenticated',t);
 end loop;
end $$;
grant select on private.organisations,private.memberships,private.role_grants,private.offerings,private.entitlements,private.observations,private.revisions,private.notifications to authenticated;
create policy organisation_read on private.organisations for select to authenticated using(private.member(id));
create policy membership_read on private.memberships for select to authenticated using(user_id=auth.uid() and private.member(organisation_id));
create policy grant_read on private.role_grants for select to authenticated using(user_id=auth.uid() and private.member(organisation_id));
create policy offerings_read on private.offerings for select to authenticated using(exists(select 1 from private.memberships m where m.user_id=auth.uid() and private.entitled(m.organisation_id,id)));
create policy entitlement_read on private.entitlements for select to authenticated using(private.member(organisation_id));
create policy observation_read on private.observations for select to authenticated using(private.source_read(id));
create policy revision_read on private.revisions for select to authenticated using(private.source_read(observation_id) and exists(select 1 from private.observations o where o.id=observation_id and private.entitled(o.organisation_id,offering_id)));
create policy notification_read on private.notifications for select to authenticated using(recipient_id=auth.uid() and private.member(organisation_id));
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.member(uuid),private.cap(uuid,text),private.entitled(uuid,text),private.source_read(uuid) to authenticated;
commit;
