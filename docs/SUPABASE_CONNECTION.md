# Supabase connection and Docker verification

Project: `owafzkdqhzfetamolavr` (`azentio`). Project URL and publishable key are configured in ignored `.env.local` with owner-only file permissions. The database password was neither requested nor used. The Next.js app uses Supabase's user-scoped Auth/Data API; a PostgreSQL connection string is an operator migration credential, not an application login.

## Hosted setup applied with explicit approval

The user approved applying the two existing migrations and synthetic catalogue seed. They were combined into one transaction without altering their schema/workflow statements and executed through the signed-in Supabase SQL editor. The exact transferred SQL was checked against SHA-256 `1c36a486e3c5bca5def95c4c3b416920fbbef22de32a2868e67fbf2c0cc1c576` before execution.

Applied sources:

- `supabase/migrations/202610300001_foundation.sql`
- `supabase/migrations/202610300002_workflow.sql`
- `supabase/seed.sql`, without account mappings

Supabase's static query warning did not recognise the migration's dynamic RLS-enabling loop. The reviewed SQL was executed unchanged; the hosted verification then confirmed RLS on every application table. The read-only query is preserved in `supabase/verify_setup.sql`.

| Hosted verification                                               | Result |
| ----------------------------------------------------------------- | ------ |
| Application tables                                                | 20     |
| Tables without RLS                                                | 0      |
| Direct INSERT/UPDATE/DELETE/TRUNCATE grants to anon/authenticated | 0      |
| Anonymous execute permission on portal RPC                        | false  |
| Authenticated execute permission on portal RPC                    | true   |
| Synthetic organisations                                           | 4      |
| Offerings                                                         | 3      |
| Auth users                                                        | 0      |
| Memberships                                                       | 0      |

The migrations were applied manually through SQL Editor. Do not blindly re-run them or run an unreviewed CLI db push against this project; no Supabase CLI migration-history repair was performed. Retain the applied filenames/checksums as the manual deployment receipt and reconcile history before adopting CLI migration management.

No Auth settings, accounts, memberships, SMTP settings, invitations or workflow records were created. The full three-client publication scenario needs legitimately verified account mappings; only the safe catalogue/organisation/theme portion of the seed was inserted.

## Docker verification

`docker compose up --build -d` built and started the development service successfully. Runtime versions are Node 24.22.2 and npm 11.16.0. Bind mount `/app` and named dependency/build-cache volumes were verified. `.env.local` is injected at runtime and was confirmed absent from the built image.

Passed inside the container: all 17 tests and `npm run typecheck`. Passed through the mapped HTTP port: anonymous dashboard/moderation/AIRA denial (401), unknown action (404), foreign-origin denial (403), protected workspace redirect (307) and public homepage rendering. `node scripts/docker-hot-reload.mjs` verified a temporary source edit reached the container-served page, then restored and verified the original source.

Use `node scripts/supabase-connection-check.mjs` for read-only provider connectivity, installed-RPC anonymous denial and private-schema exposure checks. Use the existing `test:hosted` only after legitimate verified test accounts and approved memberships are available. This connection check does not replace the multi-account acceptance matrix.

## Connection check results and remaining Docker networking issue

The host `npm run check:connection` passes all three checks: Auth HTTP 200; installed portal RPC rejects anonymous execution with PostgreSQL code 42501; private Data API schema is refused with HTTP 406/PGRST106. This confirms the configured project/key and expected exposed API boundary without creating users or writing workflow data.

A first read-only Auth request from inside Docker returned HTTP 200. Subsequent container requests repeatedly timed out with UND_ERR_CONNECT_TIMEOUT, including requests to unrelated public registry.npmjs.org and supabase.com endpoints. Recreating only Azentio's service/network did not fix it. With the user's explicit approval Docker Desktop was restarted; all previously running containers (Azentio, puc_db, cricket-redis and cricket-postgres) were restored. Local HTTP checks still pass, but outbound container requests still time out. The underlying network/VPN/firewall/proxy cause has not been established. Do not treat container-to-provider connectivity as a passed acceptance check.

This transport problem is independent of the application database permissions. Further Docker Desktop outbound-network investigation is needed; no TLS, identity or RLS controls were weakened. The non-Docker development path can use the verified host connection: stop only the web container with `docker compose stop web`, then run `npm run dev` so port 3000 and APP_ORIGIN remain consistent. The Compose service is currently left running for local preview.

The ephemeral local SQL transfer server was stopped. Its setup preview and SQL artifacts remain in ignored supabase/.temp, which is also excluded from future Docker build contexts.

## Remaining identity setup

There are no Auth users or approved memberships yet, so the application cannot complete a real user sign-in workflow. Next: approve legitimate test identities, configure exact callback URLs/custom SMTP where required, complete verification, and provision the intended client/employee memberships and separate grants. Those external identity/security changes and email sends require separate approval; none were performed as part of this connection task. No verified-account shortcut was introduced.

No GitHub push, remote repository change or Vercel deployment was performed. The optional upstream agent-skills installation was not required for this setup.
