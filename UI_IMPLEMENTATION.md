# Sethu UI implementation

This document records the first UI pass. The subsequent backend-and-UI completion phase is described in [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md), including new migrations 003–006, learning tools, library/media, employee teams and operational controls. Statements below about unchanged backend/contracts apply to that earlier UI-only checkpoint.

## Baseline and scope

Started on 30 October 2026. `feature/sethu` was created from the locally available `origin/dev` at `dceb325`, also the tip of `origin/feature/gokul-core`. All existing backend work is included. The branch tracks `origin/dev` initially; future pushes must explicitly target `feature/sethu`. No push or deployment is part of this task.

This pass implements presentation on the existing contracts. Authentication handlers, permission rules, SQL migrations, database schema, shared contracts, dependencies and AI provider logic are unchanged. No hosted memberships, accounts, enquiries or workflow records are provisioned by this work.

## Technologies

- Next.js 16.4.3 App Router: public server-rendered pages, nested workspace layout, dynamic protected section routes, loading/error boundaries.
- React 19.3.1 and TypeScript: reusable public and portal components, interactive forms, typed API reads and mutations.
- CSS: navy/green tokens, responsive grids, accessible focus styles, mobile navigation, workflow illustration and a synthetic quarterly-value chart. No UI framework, external fonts or remote media added.
- Existing Zod 4.6.7 schemas: enquiry validation and AIRA question validation. Existing server validation remains authoritative.
- Existing `src/shared/client.ts` adapter: user-scoped calls to the existing Next.js/Supabase RPC boundary. Supabase and Bedrock remain the existing backend technologies.
- Verification runtime: downloaded Node 24.22.2/npm 11.16.0; the machine's default Node 16/npm 7 is incompatible. No dependency versions were changed.

## Public routes

| Route               | Implemented presentation                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`                 | Responsive homepage, collective-learning illustration, offering cards, audience journeys, demo/event calls to action |
| `/catalogue`        | Three-offering catalogue with honest demonstration availability                                                      |
| `/catalogue/[slug]` | Offering details, illustrative inputs/outputs, entitlement explanation; unknown slugs return 404                     |
| `/solutions`        | Scenario-oriented exploration, linked to the catalogue                                                               |
| `/about`            | Privacy, review, evidence and withdrawal explanation                                                                 |
| `/request-demo`     | Validated form connected to `/api/enquiries`                                                                         |
| `/events`           | Hackathon expression-of-interest form connected to `/api/enquiries`; no invented schedule or confirmed places        |
| `/login`            | Updated sign-in presentation using the existing authentication form and flow                                         |

Enquiry submission preserves its request ID on retries with identical values. Success requires `stored: true`; no email delivery, scheduled demo or event place is claimed. Contact information is not stored in browser storage.

## Workspace routes

All new sections live under `/workspace/[id]`. The existing observation and moderation workflows retain their handlers and transition logic. Workspace selection now opens `dashboard`.

| Section               | Existing API connected                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dashboard`           | Current approved workspace, capabilities, entitled offerings and own observation count; no invented session/resource/experiment data |
| Base observation page | Existing observation component, now inside the workspace navigation                                                                  |
| `moderation`          | Existing moderator queue inside the workspace shell                                                                                  |
| `learning`            | `learning.list` with search, offering/topic/industry/region/date filters, paging; `reports.create`                                   |
| `themes`              | `themes.list`, offering-only filtering, safe cohort count, limitations and approved evidence                                         |
| `ideas`               | `ideas.list/create/update`, approved evidence selection, shared team field and six status choices; assignment checked by backend     |
| `notifications`       | `notifications.list/read`, read/unread state and paging                                                                              |
| `members`             | `members.list/revoke`, restricted invitations stored through `invitations.create`; no email or platform role promotion               |
| `playground`          | `sandbox.run`, fixed synthetic quarterly input and simulated output; no persistent runs                                              |
| `assistant`           | `/api/aira`, distinct answered/insufficient-evidence/unavailable states, citation links, current evidence and uncertainty            |

Navigation follows returned capability grants; this is presentation, not authorisation. The existing server/database still validates every operation. Account identifiers in member administration are necessary because the current API does not expose display names or email lookup.

## Data freshness and UI states

Query state is component-local and keyed by action, workspace and filters. Requests discard late responses after unmount or query changes. Shared query screens refresh every 30 seconds while visible, clear their records when hidden, and reload on returning. No global store, localStorage, exported private data or copied evidence cache is introduced.

AIRA answers clear within 30 seconds and on visibility change. Existing server citation rechecks remain in place. These UI measures reduce stale display; they cannot recall already viewed or copied material or guarantee timing in a suspended browser.

Mutations reuse request IDs after uncertain failures. Loading, empty, denied, error and success states are explicit. Pagination uses the existing page-size contract without inventing total counts. Invitation/member administration does not offer unsupported role escalation.

## Remaining work

- Live authenticated acceptance requires this checkout's designated Supabase configuration and legitimately approved client/employee/moderator accounts. No authentication bypass was added to make UI testing appear successful.
- Validate create/update/report/invitation/withdrawal journeys with those accounts, including keyboard and screen-reader use and multi-workspace switching.
- Real Bedrock synthesis and hosted provider failures remain external acceptance work.
- Restricted sessions/media, experiments, persistent sandbox runs, attachments, bookmarks, saved searches, comments, knowledge resources and integrations still need backend contracts before working controls can be connected.
- Existing core observation/moderation screens retain their initial pagination/retry behaviour; this pass does not change their business logic.
- Catalogue copy is bounded to the supplied brief and current seed. The referenced prototype could not be opened; this is not a claim of exact visual reproduction.

## Verification

| Check                        | Result                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`)  | Passed with Node 24.22.2                                                                                                                                          |
| Existing regression suite    | 17 passed, 0 failed, 0 skipped; includes SQL/RLS and guarded AIRA tests                                                                                           |
| Production build             | Passed, including the final evidence-refresh fix. The initial Windows sandbox output-directory permission failure was resolved on retry.                          |
| Local HTTP access checks     | Passed: anonymous dashboard/moderation/AIRA 401; unknown action 404; foreign Origin 403; workspace 307 redirect to login                                          |
| Public HTTP routes           | Ten public routes returned 200; unknown offering returned 404                                                                                                     |
| Desktop browser              | Homepage, offering cards and offering details inspected                                                                                                           |
| Mobile browser               | Homepage and enquiry layout inspected at 390 × 844; menu opened and navigation closed it; empty enquiry submission blocked by native required-field validation    |
| Dashboard presentation       | Existing synthetic fixtures rendered in a temporary isolated static harness; desktop/mobile layout checked, no horizontal overflow; temporary public HTML removed |
| Authenticated actions        | Not run in this checkout; legitimate provider configuration and approved accounts remain required                                                                 |
| Provider calls / live writes | No sign-in email, hosted enquiry, membership change or Bedrock request was sent                                                                                   |

The temporary fixture renderer is ignored under `supabase/.temp`; it does not affect authentication, production routes or the application build. The preview server uses a synthetic Supabase URL/key only to verify anonymous denial, not to simulate authenticated success.
