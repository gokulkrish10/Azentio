# Verification record

## Current completion phase

The `feature/sethu` follow-up passes 28 serial regression tests, TypeScript and the native production build. New tests cover learning tools, comment review/reporting, user/workspace sandbox isolation, content audiences, direct Storage object policies, employee teams and administrative escalation boundaries. See [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for current results and hosted limitations. The records below retain the original 17-test checkpoint. PGlite's test-only Storage catalog verifies SQL policies, not the hosted Storage service. No migrations or new grants have been applied to the hosted project by this phase.

Run date: 30 October 2026 (Asia/Kolkata). No GitHub push, Vercel deployment, paid service provisioning or email sending was performed. After the initial local implementation, the user explicitly approved the hosted schema/catalogue setup recorded in docs/SUPABASE_CONNECTION.md.

## Actual results

| Check                                                                                                         | Result                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                           | Passed                                                                                                            |
| `npm test`                                                                                                    | Passed: 17 tests, 0 failed, 0 skipped                                                                             |
| `npm exec --yes --package=node@24.22.2 -- node --conditions=react-server --import tsx --test tests/*.test.ts` | Passed: same 17 tests under the pinned runtime                                                                    |
| `npm run db:types`                                                                                            | Passed; public RPC types generated from applied migration SQL catalog                                             |
| `npm run build`                                                                                               | Passed early checkpoint; final pinned-runtime build recorded below                                                |
| `npm exec --yes --package=node@24.22.2 -- node node_modules/next/dist/bin/next build --webpack`               | Passed: final build includes core screens, all API routes and AIRA under Node 24.22.2                             |
| `node scripts/http-smoke.mjs` against local dev and final production servers                                  | Passed: anonymous dashboard/moderation/AIRA 401, unknown action 404, foreign-origin 403, workspace 307 to /login  |
| `curl http://localhost:3000/`                                                                                 | HTTP 200                                                                                                          |
| Browser inspection                                                                                            | Public shell and sign-in form rendered; workspace navigation reached sign-in gate at narrow viewport              |
| `docker compose --env-file .env.example config --no-env-resolution --quiet`                                   | Passed static configuration validation                                                                            |
| `docker info --format '{{.ServerVersion}}'`                                                                   | Passed on follow-up: Docker 29.6.1 daemon available                                                               |
| Docker image build/start/hot reload                                                                           | Passed on follow-up: image build/start and reversible hot reload verified                                         |
| `npm run test:hosted`                                                                                         | Not run: explicit NOT RUN, exit 2; legitimate verified test account/workspace unavailable; URL/key now configured |
| Real magic-link verification, callback, logout and authenticated browser workflow                             | Not run: no configured legitimate Auth accounts/approved memberships; SMTP/callback setup remains unverified      |
| Real Bedrock model/region/IAM/expiry request                                                                  | Not run: no configured credentials                                                                                |
| `git diff --check`                                                                                            | Passed                                                                                                            |

Initial dependency installation timed out once; retry succeeded. The first tsx CLI test attempt hit a sandbox IPC restriction; the committed test command uses Node's `--import tsx` and passes. An intermediate AIRA type error was corrected before the final typecheck. No unresolved automated failure is being presented as a pass.

## What the tests establish

`tests/database.ts` creates a disposable PGlite PostgreSQL engine and a **test-only** Auth compatibility schema. Migrations run unchanged, with real SQL functions, transactions, constraints, grants, locks and RLS. There are no mocked permission helpers. Auth identities exist only inside that disposable test database, never in deployed code or hosted seeds.

The 10 workflow tests plus foundation and enquiry database tests cover:

- Cross-tenant/workspace/source-ID tampering and anonymous SQL denial.
- Employee/client escalation, separate moderator/portal grants and administrator draft denial.
- Unsubmitted drafts hidden from moderators, including direct table queries.
- Revoked membership, disabled entitlements, direct-write/role-grant denial.
- Wrong-account/tenant, expired and replayed invitations; single-use acceptance and member revocation.
- Save privacy, consent independence/training default-off, invalid transitions and immutable submissions.
- Clarification, author amendment, stale revision conflicts, reviewed publication of an exact revision and attribution consent.
- Shared allowlist, private-source exclusion, organisation sharing not broadening historical private revisions.
- Repeated/concurrent queued requests produce one draft/audit/publication; seed reruns are idempotent.
- Duplicate organisation contributions and employee workspaces do not satisfy a three-client-organisation cohort.
- Author/moderator withdrawal removes future feed/search/retrieval, suppresses a three-to-two theme and removes idea evidence within the measured synchronous test path (under 60 seconds).
- Reports suspend/restore correctly and cannot restore withdrawn material.
- Idea ownership assignment requires independently permitted evidence; status updates are audited.
- Write-only anonymous enquiry persistence, retry safety and per-email quota.

The three AIRA tests cover current citations, missing evidence, provider failure, invalid JSON, unsupported citations, withdrawal during the provider call and no fallback to unrelated host credentials. Provider calls are injected in these tests; they do not establish model synthesis quality or real AWS access. The two contract/HTTP tests cover unsafe input/metadata, CSRF Origin, streaming body size and JSON parsing.

The engine serialises SQL execution on one test instance. Promise concurrency verifies retry/idempotency behavior with queued operations; it is **not** a demonstration of independent production sessions, contention, PostgREST connection pooling or distributed concurrency. Run those tests against hosted development Supabase before release. PGlite Auth helpers do not validate real JWTs, SSR cookies, SMTP, PKCE or provider session revocation.

## Repeat local HTTP checks

Start the actual app with `APP_ORIGIN=http://localhost:3000`. For negative-only offline HTTP checks, a synthetic Supabase URL/key can be supplied to the local process; these do not create a user and never make an authenticated operation succeed:

```sh
APP_ORIGIN=http://localhost:3000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-test-publishable-key npm run dev
```

In another terminal: `node scripts/http-smoke.mjs`. The script is restricted to loopback and never invokes sign-in/enquiry writes. Do not use synthetic config for a real demo or claim a connected Supabase project from it. For real use, configure `.env.local` as described in README.

## Hosted acceptance still required

Use at least three legitimate approved client identities, a separate moderator, an ordinary employee and an unrelated/wrong-account identity in a designated synthetic development project. Verify identity and membership separately. Exercise the same negative scenarios through Next.js HTTP and direct PostgREST, plus:

1. Complete real verification link/callback/logout. An account verified outside an approved workspace must still be denied.
2. Keep a browser session open, revoke membership/entitlement from an authorised organiser context and repeat direct API/read/AI requests.
3. Race invitation acceptance and publication from independent database connections; exactly one effect should commit. Test retry IDs and stale revision handling.
4. Withdraw evidence while AIRA is in flight. Check no future search, theme, idea evidence or returned answer retains it; measure propagation against the 60-second demonstration bound.
5. Check all UI forms using keyboard, small/wide screens, live validation, multi-workspace switching and denied/empty/loading states. Do not simulate success by disabling Auth or introducing deployed test flags.
6. Confirm Docker hot reload and native Vercel build separately, only after approval for external setup/deployment.

No private media route exists. Adding uploads, recordings, comments, exports, autocomplete or caches requires extending these checks and the parent-audience/withdrawal rules.

## Supabase and Docker follow-up

The approved hosted setup and Docker runtime results are recorded in [docs/SUPABASE_CONNECTION.md](docs/SUPABASE_CONNECTION.md). All 17 tests and TypeScript checking also passed inside the Linux container. The hosted SQL metadata check confirmed 20 application tables, RLS on every table, no direct client write grants and the expected portal function permissions. This is not a multi-account hosted workflow test.

Additional follow-up results:

| Check                                                       | Result                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Host `npm run check:connection`                             | Passed: Auth 200, anonymous portal execution 42501, private profile 406/PGRST106                                    |
| `docker compose exec -T web npm test`                       | Passed: all 17 tests                                                                                                |
| `docker compose exec -T web npm run typecheck`              | Passed                                                                                                              |
| `node scripts/docker-hot-reload.mjs`                        | Passed: temporary marker rendered; original source restored and rendered                                            |
| Docker image `.env.local` presence                          | false; runtime injection confirmed separately                                                                       |
| Container outbound provider connectivity                    | First Auth request returned 200; subsequent probes failed with connect timeouts, also to unrelated public endpoints |
| Azentio-only recreation and approved Docker Desktop restart | Completed; previous containers restored; outbound timeout remains                                                   |

An early raw HTTP private-profile check used incomplete authentication headers and returned 401. The committed check uses the same SDK authentication as the app; the corrected host check passes. Container connection failures are reported separately and are not counted as successful provider integration.
