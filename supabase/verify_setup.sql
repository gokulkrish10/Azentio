-- Read-only verification for a project after applying the approved migrations.
-- Reports counts and privilege metadata only, never profiles, source text or credentials.
select jsonb_build_object(
  'application_tables', (select count(*) from pg_tables where schemaname='private'),
  'tables_without_rls', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and not c.relrowsecurity),
  'synthetic_organisations', (select count(*) from private.organisations),
  'offerings', (select count(*) from private.offerings),
  'memberships', (select count(*) from private.memberships),
  'auth_users', (select count(*) from auth.users),
  'anon_portal_execute', has_function_privilege('anon','public.portal(text,uuid,jsonb)','EXECUTE'),
  'authenticated_portal_execute', has_function_privilege('authenticated','public.portal(text,uuid,jsonb)','EXECUTE'),
  'direct_client_write_grants', (select count(*) from information_schema.role_table_grants where table_schema='private' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))
) as setup_verification;
