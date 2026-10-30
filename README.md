# Azentio collaboration portal

Gokul's Next.js / Supabase foundation for governed collective learning. All demonstration data is synthetic. Local development only; nothing has been pushed or deployed.

## Start

1. Install Node **24.22.2** (`nvm install && nvm use`) and npm **11.16.0**.
2. `npm ci`.
3. Copy `.env.example` to `.env.local`. Configure a hosted development Supabase project's URL and publishable key; set `APP_ORIGIN=http://localhost:3000`.
4. For a new development project, manually apply the two SQL migrations in `supabase/migrations/` in filename order through the Supabase SQL editor (or your controlled migration runner). Do not reset a hosted database. Only `public` should be exposed through the Data API; keep `private` unexposed. The configured project already has these migrations; do not reapply them—see docs/SUPABASE_CONNECTION.md.
5. Configure Auth callback URLs, custom SMTP and approved memberships as described in [DEPLOYMENT.md](DEPLOYMENT.md). No accounts, memberships or entitlements are self-provisioned by sign-in.
6. `npm run dev`, or `docker compose up --build` with Docker Desktop running.
7. Open `http://localhost:3000`, sign in, select an approved workspace, save a draft and submit separately. A separately approved moderator uses their employee workspace's moderation queue.

No Supabase service-role key is needed by the application. No `.env.local` is required for offline SQL tests or the production build. Without Supabase configuration, the public shell renders and protected operations fail closed.

## Commands

| Command               | Purpose                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`         | Hot reload on `0.0.0.0:3000`                                                               |
| `npm run typecheck`   | TypeScript check                                                                           |
| `npm test`            | Isolated PostgreSQL SQL/RLS integration and AIRA/contract tests                            |
| `npm run db:types`    | Generate public RPC types from the applied migration catalog                               |
| `npm run build`       | Native Next.js production build                                                            |
| `npm run start`       | Serve the production build                                                                 |
| `npm run test:hosted` | Explicit authenticated hosted smoke check; requires separately configured test credentials |

Tests use PGlite's PostgreSQL engine, with a test-only `auth.users` / `auth.uid()` compatibility layer. They do not emulate or verify Supabase Auth, SMTP, PostgREST, production concurrency across processes, or AWS. These require live acceptance checks.

Additional read-only connection check: `npm run check:connection`. Reversible Docker hot-reload verification: `npm run test:hot-reload` while the Compose service is running.

## Collaboration

`main` is the stable release branch; `dev` is for integration; Gokul works on `feature/gokul-core`. After review and explicit local integration into `dev`, Sethu creates `feature/sethu-ui` from `dev`. No one works directly on `dev`. No push, main merge or deployment is authorised.

See [SETHU_HANDOFF.md](SETHU_HANDOFF.md), [API.md](API.md), [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [REQUIREMENTS_COVERAGE.md](REQUIREMENTS_COVERAGE.md).

## Verification status

The designated hosted development project is now configured locally and its approved schema/catalogue setup has been applied. Docker build/start, tests, typecheck and hot reload have been verified. See [connection record](docs/SUPABASE_CONNECTION.md). The host connection passes its read-only checks; container outbound internet currently times out despite a Docker Desktop restart. Real user sign-in still requires verified accounts and approved memberships. Do not reapply migrations blindly.

See TESTING.md for the final command results and limitations. The complete supplied requirements DOCX, including tables, was inspected. The supplied reference prototype could not be opened by the web tool; the basic shell follows the requested navy/green direction. The public catalogue and polished portal views are Sethu's work.
