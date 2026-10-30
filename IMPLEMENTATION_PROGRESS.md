# Portal completion implementation

## What this phase adds

This phase extends `feature/sethu` beyond the first UI pass. It uses the existing Next.js 16, React 19, TypeScript, Zod, Supabase/PostgreSQL and Supabase Storage stack. No model training or new AI provider is introduced. Support-ticket integration stays disconnected at the user's request.

| Area                   | Implemented change                                                                                               | End-goal contribution                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Observation capture    | Six explicit categories persisted with each immutable revision                                                   | Distinguishes trends, gaps, challenges, practices and suggestions without overloading the topic field |
| Onboarding explanation | Versioned acknowledgement, separate from publication/attribution/training consent                                | Explains private/organisation/community visibility before a first observation save                    |
| Bookmarks              | Personal workspace-scoped approved-publication references                                                        | Lets users revisit evidence without copying withdrawn excerpts                                        |
| Saved searches         | Personal bounded filter definitions, permission checks on execution                                              | Reuses searches without storing private results or unfiltered counts                                  |
| Comments               | Proposed comments, reviewed shared copies, author withdrawal, reporting and moderator reasons                    | Adds discussion without automatically publishing private originals                                    |
| Quality                | Useful/needs-evidence feedback and separate reviewer-assessed evidence quality                                   | Supports contribution quality without public posting-volume leaderboards                              |
| Themes                 | Configurable minimum of 3–100 organisations, suppression before pagination                                       | Implements the configurable cohort safeguard without unsafe breakdown filters                         |
| Playground             | Named persistent synthetic runs and structured feedback, scoped to user/workspace/entitlement                    | Completes the guided demonstration feedback loop without model training                               |
| Content library        | Sessions, recordings, knowledge resources, release notes, owners and review dates                                | Replaces dashboard placeholders with audience-checked published content                               |
| Experiments            | Private employee proposals, submission and separate publisher approval                                           | Adds an internal innovation workflow that clients cannot access by URL                                |
| Media                  | Private storage bucket, upload validation, audience-checked download/byte ranges                                 | Restricts recordings/PDFs at the API and direct Storage object policy layers                          |
| Public insights        | Explicitly public published resources and session information only                                               | Gives public visitors approved content without indexing employee/client records                       |
| Team spaces            | Explicit employee team membership, owner-managed roster, private team updates                                    | Supports hackathon collaboration without granting other workspace/role access                         |
| Administration         | Organisation creation, entitlement/capability/owner/publisher assignments, metadata-only audit view              | Adds operational controls while preserving separate private-learning permissions                      |
| Sign-in diagnostics    | Genuine upstream throttling returns 429; other provider failures return 503; safe allowlisted server diagnostics | Makes authentication setup diagnosable without exposing account identities or secrets                 |

## Database rollout required

These changes are local source and migration files. They have not been applied to the hosted database and no accounts, grants, emails, uploaded files or workflow records were created there.

For the previously configured development project, the receipt records migrations **001 and 002** as already applied. After review, apply **only these new migrations**, once and in order:

1. `supabase/migrations/202610300003_learning_tools.sql`
2. `supabase/migrations/202610300004_content_library.sql`
3. `supabase/migrations/202610300005_team_spaces.sql`
4. `supabase/migrations/202610300006_administration.sql`

For a fresh project, apply all six migrations in filename order. Do not reset a hosted database, reapply the original CREATE statements, or run an unreviewed CLI push over the manually managed history. Keep `private` unexposed in the Data API. Keep checksums/receipts and reconcile migration history before adopting CLI management.

The new public `schema_version()` RPC returns **6**, contains no user data and is read-only. `npm run check:connection` now checks this version and identifies an older schema as NOT READY rather than treating the presence of the original portal RPC as sufficient.

Existing public `portal` signature is unchanged. Each migration moves the previous implementation into a private, non-client-executable function and adds explicit checks for new actions. All new application tables use RLS and deny direct client writes. The disposable test database applies migrations unchanged.

## Identity and permissions for acceptance

Existing legitimately verified client and employee accounts still need approved memberships and entitlements. Nothing self-provisions at sign-in.

- Learning access supports bookmarks, saved searches, reviewed-comment reading and personal feedback. Comment submission also requires `observations.write` and explicit publication consent; reporting additionally requires `learning.report`.
- Moderator comment review and evidence grading require `learning.moderate` plus independently permitted evidence.
- Playground persistence requires `sandbox.run` and Financial Analysis Intelligence entitlement.
- Ordinary employees with `observations.write` can propose experiments and create team spaces. Experiments require an independent content publisher to publish.
- Resource/release publication requires `content.publish`; sessions require the separate `broadcast.publish` grant.
- Publishing to another organisation additionally requires an explicit `private.publisher_assignments` row. Target offering entitlements are checked without making a publisher a member of the client organisation.
- Administration and cohort configuration require `portal.admin`. Administrators cannot grant themselves privileges or delegate `portal.admin` through the app. Initial platform administrator/identity approval remains organiser-controlled. Private source access is not implicit.
- Product-owner assignments and evidence permissions remain independent.

No additional powerful grants are seeded automatically. An already authorised organiser provisions the initial administrators and publishers; the new administration screen can then manage allowed grants for other approved memberships.

## Media behaviour and limits

Migration 004 creates the private `portal-media` bucket and restrictive object policies when a Supabase Storage catalog exists. It fails if a bucket with that name is already public. Supported file types are MP4, WebM and PDF, maximum 20 MB; browser/API/bucket restrictions and simple file signatures are enforced. Signature checks are not malware scanning.

Upload a file only while the item is a draft, then publish the item to its reviewed audience. Files are served through `/api/content/[id]/media`; protected requests require the selected workspace. Explicitly public published files can be requested without a workspace. Each future read checks the parent state/audience; withdrawn objects cannot be read through the direct Storage policies either. In-flight/already downloaded content cannot be recalled.

Recordings are ordinary uploaded files, not a live broadcast transport. A streaming/webinar provider, malware scanning, robust failed-upload cleanup, production bandwidth/rate controls and large-file streaming remain operational follow-ups. PGlite tests verify the SQL policies using a minimal test-only Storage catalog; they do not emulate the hosted Storage HTTP service.

## Verification and remaining acceptance

The enlarged PostgreSQL test suite runs serially (`--test-concurrency=1`) because parallel PGlite processes exceeded the machine's memory limit. This changes test scheduling, not the assertions or production logic.

| Check                                       | Result                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                  | Passed under Node 24.22.2                                                                                                                                   |
| Regression suite                            | 28 passed, 0 failed, 0 skipped; original workflows plus new learning/content/storage/team/admin checks                                                      |
| Final comment-contribution permission check | Targeted learning-tool suite passed after restricting submission to users with observations.write                                                           |
| Native Next.js production build             | Passed; includes public Insights, media handler and expanded workspace sections                                                                             |
| Built-app HTTP gates                        | Anonymous dashboard/moderation/AIRA 401; unknown action 404; foreign Origin 403; workspace 307 redirect to login                                            |
| Browser presentation                        | Synthetic library/resource/employee-experiment cards inspected at 1280 and 390 widths; no horizontal overflow. Public Insights unavailable state inspected. |
| Hosted acceptance                           | Not run; migrations/grants/SMTP and actual Storage transport remain pending                                                                                 |

Observation lists, moderation lists and author revision history now include page navigation. The original core form retry behaviour is otherwise retained; the new mutation forms preserve their request IDs across uncertain retries.

Still required before claiming a working hosted demonstration:

- Review/apply migrations 003–006 and verify schema version 6 on the intended development project.
- Resolve Supabase Auth/SMTP configuration, confirm callback URLs and use legitimate approved accounts. No sign-in emails are sent by local tests.
- Test the real client/moderator/publisher/admin/ordinary-employee journeys in separate browser contexts, including live revocation and current evidence checks.
- Upload/play a synthetic recording and download a PDF through actual Supabase Storage; test direct foreign-user object denial and withdrawal.
- Test live PostgREST concurrency and Storage transport; local SQL engine tests do not establish multi-process hosted behaviour.
- Supply organisation-approved workspace terms. The new sharing explanation is not a fabricated legal agreement.

Explicitly outside this phase: support provider integration (user requested disconnected), provider-backed notification email/outbox worker (P1), observation attachments (permitted P0 deferral), optional federated training (P2), advanced semantic clustering/digests and production-approved automated retention/purge. Bedrock remains an optional existing integration for synthesis and is not a prerequisite for the deterministic portal demonstration.
