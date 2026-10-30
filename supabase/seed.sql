-- Idempotent SYNTHETIC fixtures. Apply manually to a designated development project only.
-- No Auth accounts are created. Map existing, legitimately verified accounts in the same transaction:
-- SET LOCAL demo.client_a = 'verified-user-uuid'; similarly client_b, client_c and employee.
-- With no mapping, only synthetic catalogue/organisation/theme data is inserted.
begin;
insert into private.offerings values('financial-analysis-intelligence','Financial Analysis Intelligence'),('document-intelligence','Document Intelligence'),('regulatory-intelligence','Regulatory Intelligence') on conflict do nothing;
insert into private.organisations(id,name,kind) values
 ('10000000-0000-4000-8000-000000000001','Synthetic Cedar Finance','client'),
 ('10000000-0000-4000-8000-000000000002','Synthetic Meridian Credit','client'),
 ('10000000-0000-4000-8000-000000000003','Synthetic Harbour Capital','client'),
 ('10000000-0000-4000-8000-000000000004','Synthetic Azentio Innovation','employee') on conflict do nothing;
insert into private.entitlements(organisation_id,offering_id) select id,'financial-analysis-intelligence' from private.organisations where id in
 ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') on conflict do nothing;
insert into private.themes values('seasonality-context','Seasonality context','financial-analysis-intelligence','seasonality') on conflict do nothing;
do $$
declare users uuid[]; org_id uuid; obs_id uuid; employee_id uuid; i integer; v integer;
begin
 if nullif(current_setting('demo.client_a',true),'') is null then return; end if;
 users:=array[current_setting('demo.client_a')::uuid,current_setting('demo.client_b')::uuid,current_setting('demo.client_c')::uuid];
 employee_id:=current_setting('demo.employee')::uuid;
 if (select count(distinct x) from unnest(users||employee_id) x)<>4 then raise exception 'Use four distinct verified accounts'; end if;
 if exists(select 1 from unnest(users||employee_id) x where not exists(select 1 from auth.users where id=x and email_confirmed_at is not null and not coalesce(is_anonymous,false))) then raise exception 'Verified accounts required'; end if;
 if not exists(select 1 from auth.users where id=employee_id and lower(email) like '%@azentio.com') then raise exception 'Approved employee work identity required'; end if;
 for i in 1..4 loop
  org_id:=('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into private.memberships(organisation_id,user_id,role,approved,work_identity_verified)
   values(org_id,case when i=4 then employee_id else users[i] end,case when i=4 then 'employee' when i=1 then 'client_admin' else 'client_member' end,true,i=4) on conflict do nothing;
  insert into private.role_grants select org_id,case when i=4 then employee_id else users[i] end,c from unnest(array['observations.write','learning.read','learning.report','sandbox.run']) c on conflict do nothing;
  if i=1 then insert into private.role_grants values(org_id,users[i],'members.manage') on conflict do nothing; end if;
  if i=4 then
   insert into private.role_grants select org_id,employee_id,c from unnest(array['learning.moderate','ideas.write']) c on conflict do nothing;
   insert into private.owner_assignments values(org_id,employee_id,'financial-analysis-intelligence') on conflict do nothing;
  end if;
 end loop;
 for i in 1..3 loop
  org_id:=('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  obs_id:=('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  v:=case when i=2 then 2 else 1 end;
  insert into private.observations(id,organisation_id,author_id,state,current_revision,submitted_revision) values(obs_id,org_id,users[i],'published',v,null) on conflict do nothing;
  insert into private.revisions(observation_id,version,title,body,offering_id,topic,industry,region,period_start,period_end,evidence_type,confidence)
   select obs_id,n,'Synthetic seasonal cash-flow comparison','SYNTHETIC private source: quarterly SME cash flow varies by season. Equivalent-period comparisons need explanatory context. No real customer data.','financial-analysis-intelligence','seasonality','Financial services','Broad synthetic region','2026-01-01','2026-06-30','synthetic scenario','medium' from generate_series(1,v)n on conflict do nothing;
  insert into private.consents(observation_id,version,processing,publication,attribution,training,actor_id) select obs_id,n,true,true,false,false,users[i] from generate_series(1,v)n on conflict do nothing;
  update private.observations set submitted_revision=v where id=obs_id and submitted_revision is null;
  insert into private.publications(id,observation_id,version,organisation_id,title,body,offering_id,topic,industry,region,period_start,period_end,evidence_type,confidence)
   values(('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,obs_id,v,org_id,'Seasonal SME comparisons need context','SYNTHETIC reviewed contribution: explain equivalent-period seasonal comparisons before interpreting SME cash-flow differences. This small scenario is illustrative only.','financial-analysis-intelligence','seasonality','Financial services','Broad synthetic region','2026-01-01','2026-06-30','synthetic scenario','medium') on conflict do nothing;
  insert into private.decisions(id,observation_id,version,actor_id,action,note) values(('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,obs_id,v,employee_id,'publish','Synthetic copy reviewed; identifying details removed.') on conflict do nothing;
  if i=2 then insert into private.decisions(id,observation_id,version,actor_id,action,note) values('40000000-0000-4000-8000-000000000010',obs_id,1,employee_id,'clarify','Please distinguish simulated seasonal effects from market prevalence.') on conflict do nothing; end if;
 end loop;
 insert into private.observations(id,organisation_id,author_id,state,current_revision,submitted_revision) values('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',users[1],'clarification',1,null) on conflict do nothing;
 insert into private.revisions(observation_id,version,title,body,offering_id,topic,industry,region,period_start,period_end,evidence_type,confidence) values('20000000-0000-4000-8000-000000000004',1,'Synthetic clarification pending','SYNTHETIC: seasonal comparisons may need extra explanation. Please clarify the simulated observation period and the limits of this evidence.','financial-analysis-intelligence','seasonality','Financial services','Broad synthetic region','2026-01-01','2026-06-30','synthetic scenario','low') on conflict do nothing;
 insert into private.consents(observation_id,version,processing,publication,actor_id) values('20000000-0000-4000-8000-000000000004',1,true,true,users[1]) on conflict do nothing;
 update private.observations set submitted_revision=1 where id='20000000-0000-4000-8000-000000000004' and submitted_revision is null;
 insert into private.decisions(id,observation_id,version,actor_id,action,note) values('40000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000004',1,employee_id,'clarify','Please clarify the observation period and evidence limitations.') on conflict do nothing;
 insert into private.ideas(id,title,problem,offering_id,outcome,owner_id,owner_workspace,team,priority,status) values('50000000-0000-4000-8000-000000000001','Explain seasonality-aware comparisons','Synthetic evidence suggests seasonal differences can be mistaken for underlying performance changes.','financial-analysis-intelligence','Explain equivalent-period comparisons with seasonality context.',employee_id,'10000000-0000-4000-8000-000000000004','Financial Analysis team','medium','Under review') on conflict do nothing;
 insert into private.idea_evidence select '50000000-0000-4000-8000-000000000001',id from private.publications where id in('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003') on conflict do nothing;
end $$;
commit;
