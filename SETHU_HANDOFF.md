# Sethu handoff

## Branch and integration order

Gokul's work is local on `feature/gokul-core`. Review the tested foundation and live-configuration gaps before merging locally into `dev`. Only after that integration, create `feature/sethu-ui` from `dev`. Do not create it from an older main and do not work directly on dev. Gokul's later backend changes and Sethu's UI changes should integrate through dev, followed by SQL, auth and UI regression checks before any approved main release. No remote push or deployment has been performed or authorised.

## Exact ownership

| Paths                                                                                                                                                             | Owner and coordination                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/server/**`, `src/app/api/**`, `src/app/auth/**`, `src/proxy.ts`                                                                                              | Gokul: identity, transactions, permissions, AIRA                 |
| `supabase/**`, `scripts/**`, `tests/**`, runtime/Docker configs                                                                                                   | Gokul                                                            |
| `src/shared/contracts.ts`, `database.types.ts`, `client.ts`, `fixtures.ts`                                                                                        | Shared contract boundary; coordinate any change with Gokul       |
| `src/app/login/**`, `src/app/workspaces/**`, `src/app/workspace/[id]/page.tsx`, `src/app/workspace/[id]/moderation/**`, `src/components/core/**`                  | Gokul functional screens; coordinate later visual improvements   |
| `src/app/page.tsx`, future `src/app/catalogue/**`, `src/app/solutions/**`, `src/app/about/**`, `src/components/public/**`                                         | Sethu public homepage, catalogue, navigation, media presentation |
| Future `src/app/workspace/[id]/dashboard/**`, `employee/**`, `learning/**`, `themes/**`, `ideas/**`, `members/**`, `notifications/**`, `src/components/portal/**` | Sethu dashboards and presentation using existing APIs            |
| Future `src/app/request-demo/**`, `src/app/events/**`                                                                                                             | Sethu form presentation → `/api/enquiries`                       |
| `src/app/layout.tsx`, `globals.css`, `next.config.ts`, `package.json`, lockfile                                                                                   | Shared; coordinate shell/tokens/dependency changes               |

Future paths above are reserved ownership locations, not claims that pages already exist. Keep presentation in components and backend imports out of client components. Do not independently change auth, RLS, schemas, moderation transitions or AI permissions.

## Startup

Use Node 24.22.2 and npm 11.16.0; `npm ci`; copy `.env.example` to `.env.local`; configure hosted development Supabase and exact APP_ORIGIN. Ask Gokul/organiser to apply migrations and approve legitimate accounts. With Docker Desktop running: `docker compose up --build`. Alternatively `npm run dev`. Do not reset a hosted DB. Docker volume dependencies may need `docker compose run --rm web npm ci` after lockfile updates. Never place secrets in browser code or NEXT_PUBLIC AWS variables.

The unconfigured shell works without secrets. `src/shared/fixtures.ts` is a clearly synthetic presentation fixture, not an auth shortcut and not a fallback returned by APIs. Build isolated presentation components against it, then connect to verified accounts and the API. No live AI fixture is disguised as a model response.

## APIs ready to connect

Use `call(action, workspaceId, payload)` from `src/shared/client.ts`; request and response types are in `contracts.ts`. It sends a same-origin JSON POST and surfaces stable error codes. See API.md for every action. Client inputs are validated again by server and database; hiding controls is not authorisation.

- Workspaces/dashboard: active organisation, grants, entitled offerings and own contribution count. Sessions, experiments and resources currently return empty arrays and are explicit remaining backend work.
- Observations and moderation: functional Gokul screens already provided, including author revision/consent history and author/moderator withdrawal.
- Learning: approved feed with page, offering/topic/industry/region/period/search filters; implement Next/Previous using pageSize and an empty next page.
- Themes: live safe cohort counts/evidence; only offering filter. Empty means suppressed or no eligible cohort. Never infer missing counts or build arbitrary breakdowns from this API.
- Ideas: list safe fields/evidence, create with offering assignment and independent evidence permission, update status. Use the six allowed statuses; Under review is not a delivery promise.
- Invitations/members: list, store invitation for existing verified intended user ID, accept once, revoke client member. Invitation email is not sent. Admin promotion remains organiser controlled.
- Notifications: list and mark read. They are in-app records, not email delivery.
- Sandbox: deterministic entitled synthetic seasonality scenario, explicitly simulated. No real lending decision, uploads or persistent sandbox runs.
- Public demo/event enquiry: write-only persistence response; never display “email sent”.
- AIRA: `/api/aira`; render answered / insufficient_evidence / unavailable. Evidence/citations must remain visible, and answers must not be persisted as durable summaries or reused across workspaces.

## Suggested first UI changes

Public home/catalogue and demo form can start independently. Then build workspace dashboards and empty states, followed by approved learning/theme views, ideas, notifications and member administration. Coordinate before changing core forms or shell. Keep private originals visually distinct from shared copies. Re-fetch evidence when displaying an idea; never retain withdrawn excerpts in a global client store. Clear workspace state on switching.

## Remaining backend/UI gaps

Full catalogue content, audience-restricted sessions/media, experiment submissions, persistent isolated sandbox runs, member role promotion policies, comments/reporting for comments, bookmarks, saved searches, knowledge resources, team spaces, release notes and support integrations are not implemented. Notification email is P1; attachments are omitted in P0; genuine federated training is excluded optional P2. Do not build controls that imply missing functionality works. See REQUIREMENTS_COVERAGE.md for owners and follow-up scope.

## Connection follow-up

Gokul’s local `.env.local` now targets the designated hosted development project, with migrations and catalogue applied after approval. Docker runtime/hot reload, container tests/typecheck and anonymous HTTP gates passed. Do not distribute `.env.local` or reapply the schema; configure your own local environment and request an approved verified account/membership. See docs/SUPABASE_CONNECTION.md.

Current environment limit: host Supabase checks pass, but Docker outbound internet times out even after the approved engine restart. Build/tests/typecheck/hot reload and local HTTP gates pass. Use the documented native development fallback while Docker networking is investigated; do not interpret a local sign-in gate as proof of a working provider session.
