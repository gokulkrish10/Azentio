# Portal API

## Completion phase actions

Migrations 003–006 add the actions below on the existing authenticated envelope. See `src/shared/contracts.ts` for exact strict input/output types. Existing tenant/current-grant/entitlement checks, same-origin POSTs and request-keyed mutations continue to apply.

- `onboarding.acknowledge`: versioned sharing-explanation acknowledgement, independent of contribution consent.
- `bookmarks.list/set`, `searches.list/save/delete`: personal workspace-scoped references and filter definitions, no copied results.
- `comments.list/create/withdraw/report/queue/review`: proposed originals, separate reviewed shared text, reporting/suspension, author notification and audited decisions.
- `feedback.set`, `quality.get/set`: personal useful/needs-evidence feedback and moderator-assessed evidence quality.
- `learning.configure`: portal-admin-only cohort minimum, 3–100; theme suppression occurs before pagination.
- `sandbox.save/runs/feedback`: named user/workspace-isolated deterministic scenario snapshots and feedback.
- `content.list/get/save/submit/publish/withdraw/feedback`: audience-scoped sessions/resources/release notes and employee experiments; publisher grants are separate from ordinary employee status.
- `content.upload/attach/asset`: parent permission checks used by `/api/content/[id]/media` (multipart POST and audience-checked GET/byte ranges). The route bounds uploads to 20 MB and accepts MP4/WebM/PDF.
- `teams.list/get/create/add/remove/post`: explicit employee-only team membership, owner-managed roster and private team updates.
- `admin.organisations/members/audit`, `admin.organisation.create`, `admin.entitlement/grant/owner/publisher`: separately granted operational controls. No self-grants or platform-admin delegation; no private contribution bodies.

`public.content_public(p_id uuid default null)` is an anonymous read-only RPC returning only explicitly public published content. `public.schema_version()` is an anonymous read-only integer version probe (current 6). Neither exposes private records. The database type generator includes both.

Sign-in failures keep a generic public `SIGN_IN_UNAVAILABLE` message. Only actual upstream throttling maps to HTTP 429; other provider failures map to 503. Safe server diagnostics contain an allowlisted provider code/status, never raw error messages, email, tokens or credentials.

All protected handlers use Node runtime, verified Supabase Auth cookies, current database membership/capability/audience/entitlement checks and `Cache-Control: private, no-store`. Browser callers should use `src/shared/client.ts`; its generic inputs/outputs match `contracts.ts`. Do not send roles, capabilities or entitlements as proof of permission. No privileged database key is used by ordinary requests.

## Authentication and envelope

`POST /api/auth/login` accepts `{email}`. It requests a real verification link for an existing approved account; it does not create users or memberships. This is the explicitly requested sign-in action, not a test shortcut. `/auth/callback?code=...` exchanges the PKCE code and redirects only to `/workspaces`. `POST /api/auth/logout` signs out.

`POST /api/portal/<action>` uses this JSON envelope:

```json
{ "workspaceId": "approved-organisation-uuid", "payload": { "page": 0, "pageSize": 20 } }
```

For `workspaces`, `workspaceId` is null and payload is `{}`. For invitation acceptance, workspaceId selects the invitation's organisation; acceptance validates its intended verified account without assuming existing membership. All browser POSTs require an `Origin` exactly matching server-only `APP_ORIGIN` and `Content-Type: application/json`. Cross-origin/missing-origin direct calls are rejected. Nonbrowser integrations must deliberately supply the expected Origin and authenticated cookies; Origin is CSRF protection, never identity verification.

Payload limit is 24,000 bytes. IDs are UUIDs. Unknown actions and extra input fields fail validation. Every mutation other than single-use invitation acceptance requires a `requestId` UUID. Reuse it for retries of the same operation. It is scoped to actor/workspace/action and returns only the original acknowledgement; use a new ID for a different operation.

## Actions

| Action                  | Payload                                                                                               | Output / checks                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`            | `{}`                                                                                                  | `{items:[{id,name,kind,role}]}`; approved current memberships only                                                              |
| `dashboard`             | `{}`                                                                                                  | `{workspaceId,capabilities,offerings,contributionCount,sessions,experiments,resources}`; last three arrays currently empty      |
| `observations.list`     | pagination                                                                                            | `{items:Observation[]}`; own or explicitly organisation-shared private sources, current entitlement                             |
| `observations.history`  | pagination + `{id:sourceUuid}`                                                                        | Author-only immutable revisions, per-revision audience and consent snapshots                                                    |
| `observations.save`     | SaveObservation below                                                                                 | `{id,revision,state:"draft"}`                                                                                                   |
| `observations.submit`   | `{requestId,id,expectedRevision}`                                                                     | `{id,revision,state:"submitted"}`; author + independent processing/publication consent                                          |
| `observations.withdraw` | `{requestId,id}`                                                                                      | `{id,state:"withdrawn"}`; source author; synchronous future-read removal                                                        |
| `moderation.list`       | pagination                                                                                            | `{items:ReviewItem[]}`; explicit employee moderation grant + offering entitlement; never unsubmitted drafts                     |
| `moderation.decide`     | decision below                                                                                        | `{id,publicationId?,ok:true}`; exact submitted revision                                                                         |
| `learning.list`         | pagination, optional `query`, `offeringId`, `topic`, `industry`, `region`, `periodStart`, `periodEnd` | `{items:SharedPublication[],page,pageSize}`; approved/available and currently permitted only                                    |
| `themes.list`           | pagination, optional `offeringId`                                                                     | `{items:Theme[]}`; minimum three distinct eligible organisations after offering eligibility; no small-cohort breakdowns         |
| `ideas.list`            | pagination                                                                                            | `{items:Idea[]}`; entitled offering and at least one currently eligible supporting contribution                                 |
| `ideas.create`          | `{requestId,title,problem,offeringId,evidence:[publicationUuid],outcome,team,priority}`               | `{id,ok:true}`; assigned employee owner + ideas.write + independent learning.read; evidence matches offering                    |
| `ideas.update`          | `{requestId,id,status}`                                                                               | `{id,ok:true}`; assigned existing owner, entitlement, audited; generic author notifications                                     |
| `reports.create`        | `{requestId,id:publicationUuid,reason}`                                                               | `{ok:true}`; eligible publication + learning.report; one per reporter/publication                                               |
| `reports.resolve`       | `{requestId,id:reportUuid,note,restore:boolean}`                                                      | `{ok:true}`; moderator + entitlement; cannot restore withdrawn/superseded evidence                                              |
| `members.list`          | `{}`                                                                                                  | `{items:Member[],invitations:Invitation[]}`; client admin grant in active client organisation                                   |
| `members.revoke`        | `{requestId,id:userUuid}`                                                                             | `{ok:true}`; same-org client members only, not self or admin                                                                    |
| `invitations.create`    | `{requestId,intendedUserId,role:"client_member"}`                                                     | `{id,stored:true,emailSent:false}`; client admin, verified intended account, 48-hour expiry; no email sent                      |
| `invitations.accept`    | `{id:invitationUuid}`                                                                                 | `{accepted:true}`; correct verified account and organisation, unexpired, locked single use; cannot reinstate revoked membership |
| `notifications.list`    | pagination                                                                                            | `{items:Notification[]}`; recipient + workspace only                                                                            |
| `notifications.read`    | `{requestId,id}`                                                                                      | `{ok:true}`; recipient only                                                                                                     |
| `sandbox.run`           | `{offeringId,scenario:"seasonal-sme"}`                                                                | Labelled synthetic/simulated deterministic example; entitlement + sandbox.run; no real decision or persistence                  |

Pagination defaults: `page=0`, `pageSize=20`; maximum pageSize 50 and page 500. Read results have no unfiltered totals/suggestions. Use page-based Next/Previous and an empty page as the end. Pages can change when new items are published or withdrawn. Workspaces/members are bounded by provisioned organisation membership in this initial build; production member-list pagination is a follow-up.

### Draft and review payloads

SaveObservation contains `requestId`, optional `id` + `expectedRevision` for an edit, `title` (5–160), `body` (20–6000), `offeringId`, `topic`, `industry`, `region` (each max 80), ISO-date `periodStart`/`periodEnd`, `evidenceType` (`synthetic scenario`, `operational observation`, `research summary`), `confidence` (`low`, `medium`, `high`), optional HTTPS `evidenceUrl` (max 1000; never fetched), `audience` (`private` default or explicit `organisation`) and `consent`:

```json
{ "processing": true, "publication": false, "attribution": false, "training": false }
```

A save is not a submission. Submitted revisions are immutable. Editing a published contribution creates a new private draft and removes the old shared representation immediately. Renew review/consent before publishing it again.

Moderation decisions contain `requestId`, source `id`, `expectedRevision`, `decision` and `note` (1–2000, visible to author). Decisions are `clarify`, `reject`, `publish`, `suspend` or `withdraw`. Publish additionally requires reviewed `title`, `body`, `topic`, `industry`, `region`, `periodStart`, `periodEnd`; optional `attribution` requires the author's independent consent. Offering, evidence type and confidence come from the submitted revision. Review/suspension is independent of website content/broadcast publishing grants.

### Shared output

`SharedPublication` includes exactly `id`, `title`, `body`, `offeringId`, `topic`, `industry`, `region`, `periodStart`, `periodEnd`, `evidenceType`, `confidence`, `attribution`, `publishedAt`. Its ID is a publication ID, not a private source lookup ID. No organisation ID, source ID, author profile, attachment, original evidence link or internal note is returned.

Themes contain safe evidence objects, distinct organisation count (only above threshold), observation period, latest update and limitations. Idea evidence is rebuilt on every read and loses withdrawn references immediately; no copied evidence excerpts are persisted. Shared idea text must be suitable for all entitled approved participants and must not promise unapproved delivery. Status values: `Proposed`, `Under review`, `Planned`, `In progress`, `Released`, `Not proceeding`. Owner is represented by the reviewed shared team field; private owner account IDs are omitted.

## Public enquiries

`POST /api/enquiries` accepts `{requestId,name,email,kind:"demo"|"event",message}` and returns HTTP 202 `{stored:true,emailSent:false}`. No read endpoint exists. Per-email/day quota is five and request IDs are idempotent. Production abuse controls beyond this quota remain required. Form presentation belongs to Sethu.

## AIRA

`POST /api/aira`: `{workspaceId,question}` (5–500 characters). Returns `AiraResult`: `answered` with bounded statements/citations, uncertainty and current evidence; `insufficient_evidence`; or `unavailable`. No response caching. Do not retain generated answers as permanent themes. Provider failure does not break other portal actions. `learning.recheck` is an internal database action for AIRA, not exposed through the HTTP action allowlist.

## Errors

JSON: `{ "error": {"code":"ACCESS_DENIED"} }`. Validation errors may include safe field names/messages, never raw private values or database messages.

| HTTP | Meaning                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 400  | INVALID_INPUT / INVALID_JSON / INVALID_OPERATION (transition, constraint, consent, duplicate conflict) |
| 401  | SIGN_IN_REQUIRED                                                                                       |
| 403  | ORIGIN_DENIED / ACCESS_DENIED; hidden and absent resource IDs are intentionally indistinguishable      |
| 404  | NOT_FOUND action                                                                                       |
| 409  | REVISION_CONFLICT; reload before retrying edits                                                        |
| 413  | BODY_TOO_LARGE                                                                                         |
| 415  | JSON_REQUIRED                                                                                          |
| 429  | SIGN_IN_UNAVAILABLE or public-enquiry quota                                                            |
| 503  | SERVICE_UNAVAILABLE / ENQUIRY_UNAVAILABLE                                                              |

Authorisation happens in both the application and SQL transaction. Direct PostgREST calls to the exposed RPCs remain subject to the database checks. There is no uploads/media/export endpoint to bypass.
