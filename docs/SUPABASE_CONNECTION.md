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

This transport problem is independent of the application database permissions. Further Docker Desktop outbound-network investigation is needed; no TLS, identity or RLS controls were weakened. For the client walkthrough, only the Azentio web container was stopped. The native Next.js development server now runs with Node 24.22.2 on `127.0.0.1:3000`, matching `APP_ORIGIN=http://localhost:3000`. An existing Azentio-only development process on port 3001 was stopped before starting it. To reproduce this local-only runtime, use `npm exec --package=node@24.22.2 -- node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000` after stopping the web container. Do not start a second server against the same `.next` development directory.

The ephemeral local SQL transfer server was stopped. Its setup preview and SQL artifacts remain in ignored supabase/.temp, which is also excluded from future Docker build contexts.

## Initial identity setup status

At the end of the initial connection task there were no Auth users or approved memberships. Real sign-in still needed legitimate identities, exact callback URLs/custom SMTP where required, verification, and intended client/employee memberships and separate grants. Those external identity/security changes and email sends required separate approval; none were performed during that initial task. The approved follow-up below supersedes that identity status. No verified-account shortcut was introduced.

## Approved client walkthrough follow-up

The user subsequently approved the exact local callback `http://localhost:3000/auth/callback`, one verification invitation to their selected personal email, and client-only membership after verification. Supabase confirmed the invitation was sent; the recipient completed verification, and the dashboard confirmed a non-anonymous, confirmed account before provisioning. Personal email/account mappings and screenshots are kept in ignored `supabase/.temp`, outside Git and Docker images.

The reviewed access transaction was transferred with SHA-256 `0fa957d539dad745f58209d21eb6ab48e7595721e70cf683277ed0122441a9c2` and executed once. Hosted results confirmed `Synthetic Cedar Finance`, role `client_member`, `approved=true`, `work_identity_verified=false`, no revocation, and exactly `learning.read`, `learning.report` and `observations.write`. No employee, moderator, client-admin, owner or portal-admin permissions were granted. The transaction requires an already confirmed account, preserves revocation and refuses unexpected broader existing grants. Its offline PostgreSQL check verified missing/unverified identity denial, idempotency, exact grants, isolation from another user and preserved revocation.

The host connection checks passed again (Auth 200, anonymous portal 42501, private schema 406/PGRST106); the same container check still timed out. The local sign-in page is reachable in Chrome with the selected email prefilled. The invitation confirmed identity; completing the application's separate PKCE sign-in still requires the user to request a link from this page and open that link in the same Chrome profile. No additional email was sent automatically. Authenticated browser acceptance and the multi-account hosted matrix remain pending. Custom SMTP and employee identity setup remain unconfigured.

No GitHub push, remote repository change or Vercel deployment was performed. The optional upstream agent-skills installation was not required for this setup.
