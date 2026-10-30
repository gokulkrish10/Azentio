# Architecture and trust boundaries

One TypeScript Next.js App Router application, one Supabase-managed PostgreSQL database, Supabase Auth and server-only Bedrock Converse. Native Next.js source is the eventual Vercel deployment unit. Docker is a local-development tool. There is no separate API server, queue, vector database, federated training or actual financial product.

## Request path

Browser → Next.js handler → Supabase SSR client scoped to the verified user → PostgreSQL transaction RPC → allowlisted response. Next.js `getUser()` validates identity with Auth. The proxy refreshes cookies; it does not decide resource access. Protected server pages repeat identity and database checks. Mutating and read RPC HTTP requests use JSON POST, exact configured Origin and no-store responses. Neither cookies nor workspace IDs prove membership.

Every `portal` request checks the current verified account, approved membership and work identity where applicable. Product actions also check offering entitlements and separate capabilities. Client membership cannot confer employee capabilities. Employee status alone confers no administrator or moderator permission. Portal/content/broadcast grants are distinct and confer no implicit private-source access. Product-owner assignment and learning-read permission are both needed for idea evidence.

## Database boundary

`public` contains only the `portal` and `enquire` RPCs. All data tables are in the unexposed `private` schema, all have RLS enabled, all direct writes are revoked. Selected private tables have read policies for defense in depth; publications, provenance, internal decisions, consents, reports and audit data have no direct client SELECT grant. There are no views. Definer functions have an empty search_path, qualified names, explicit caller/permission checks and tightly scoped EXECUTE grants. An operator must review future functions and never expose `private` through PostgREST.

The public RPC signature is generated from the real applied PostgreSQL catalog. Private tables intentionally have no generated browser-facing table API. Typed presentation contracts live separately in `src/shared/contracts.ts`; `client.ts` is the browser adapter. Server modules import `server-only`.

## Observation lifecycle

| Action | Actor | State condition | Result |
| --- | --- | --- | --- |
| Save | Source author, current membership, observations.write, entitlement | New / draft / clarification / rejected / published | New immutable revision, draft state; existing publication removed |
| Submit | Same author | Draft / clarification / rejected; exact current revision; processing + publication consent | Submitted revision pointer locked |
| Clarify / reject | Approved employee moderator + entitlement | Submitted; exact submitted revision | Recorded decision, author notification |
| Publish | Same moderator | Submitted; exact revision and consent | Reviewed copy in separate publication table; published state |
| Suspend | Same moderator | Published | Available=false; recorded decision |
| Withdraw | Source author | Any existing source state | Withdrawn; all publications unavailable |
| Resolve report | Moderator + entitlement | Matching current, nonwithdrawn revision | Recorded resolution, keep unavailable or restore |

Rejected material is amended as a new revision before a meaningful resubmission. Submission locks the snapshot, not only the form. A published edit immediately removes its previous shared copy; renewed consent and review are required. Saving defaults to author-only unless the author explicitly chooses organisation visibility. Community consent alone does not submit or publish. Consent fields are independent; training defaults off and no training is implemented.

All mutation acknowledgements use per-actor/workspace/action UUID request IDs, advisory locks and transaction-local writes. Publications additionally have revision uniqueness and one-available-copy uniqueness. Decisions and notifications commit together. Reuse the request ID on network retries; a new ID is a new request. Existing replay acknowledgements contain no private text. Invitation acceptance locks its row, checks expiry/account/organisation and consumes it once.

## Shared data and withdrawal

Private sources never feed shared indexes or Bedrock. `private.shared` constructs a strict allowlist: public publication ID, reviewed text/taxonomy, broad observation period, confidence, evidence type, reviewed attribution and publication date. Source IDs, tenant IDs, profiles, evidence links and moderator notes never appear in shared payloads. The full-text index covers reviewed copies only. Approved content still requires careful human privacy review; de-identification and the three-organisation rule are not anonymity guarantees.

Feed pagination/filtering happens after eligibility checks. There is no unfiltered count, autocomplete, export or suggestion endpoint. Themes count distinct eligible organisations, suppress below three, and permit only offering-level filtering. No geography/time/industry cohort breakdowns are supported. Aggregates and evidence are computed live. Ideas store evidence references, not excerpts; every read rebuilds permitted evidence and hides ideas with no currently eligible evidence. Idea title/problem/outcome/team are explicitly shared fields; owners must never put private tickets, roadmaps or delivery promises there.

Withdrawal updates source and publication availability in one transaction. Subsequent feed/search/theme/idea/AI queries exclude it synchronously; there is no application cache or persisted generated summary. AIRA rechecks citations after the provider returns. Content already viewed or copied cannot be recalled; no claim of reversing training is made.

## AIRA

Retrieve at most eight currently permitted approved publications → send bounded reviewed excerpts with an explicit untrusted-evidence system instruction → validate a small structured answer and all citation IDs → recheck eligibility before returning. No tools, business-state changes, private retrieval, cross-audience history or response cache. Membership/entitlement loss during the call fails closed. Provider errors/configuration absence return an honest unavailable status without leaking SDK errors or secret values. The latest eight approved records form the initial bounded retrieval set; semantic retrieval, ranking and synthesis quality evaluation remain follow-up work.

## Retention and operations

Demo policy: retain immutable consent/decision/audit history and withdrawn private sources for 90 days in the designated development project, accessible only through required permissions or audited operator access. Then an approved operator should export required audit metadata and delete development data according to the organisation's actual policy. Automated retention/purge is not implemented; production retention and legal requirements need approval. Audit records contain actor/workspace/action/resource/time, never source text. Avoid request-body logging and provider error dumps in hosting observability. Backups remain subject to the provider's configured retention.

No attachment or private-media route is implemented. Protected media, uploads and external source fetching must not be added without authorisation/storage policies. Stored in-app notifications are not delivered email. Public enquiries are write-only, length-validated, request-keyed and limited to five per email per day; provider-backed anti-abuse is a production gap.
