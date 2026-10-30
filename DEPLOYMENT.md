# Deployment and identity setup

No push, paid provisioning, external account changes or deployment has been performed. These are operator instructions for a later approved release. The implementation is not labelled production ready.

## Hosted development Supabase

Use a separate designated development project. Review and apply `202610300001_foundation.sql` then `202610300002_workflow.sql` once. Use a controlled migration history; do not reapply CREATE statements to an existing schema and do not automatically reset hosted data. Backup/review any pre-existing project before applying migrations. Data API exposure should include `public` only; never add `private`.

The application needs only the project URL and publishable key. Supabase's newer publishable key is public configuration; secret/service-role keys do not belong in the application. Operator SQL access is needed only for migrations and explicitly approved provisioning.

Create real user accounts through the configured managed Auth provider/organiser onboarding. Require email confirmation. Never insert fake verified Auth users, disable verification, allow anonymous sign-in to bypass membership, or give Sethu Supabase project-administrator access to test client behavior. The test-only Auth schema in `tests/database.ts` is confined to the disposable local PostgreSQL engine and must never be deployed.

Employee accounts require a verified @azentio.com identity AND an approved employee membership with `work_identity_verified=true`. Prefer Entra/OIDC when registration becomes available; this build uses managed email verification with organiser-approved provisioning. Client accounts need explicit approved membership or an invitation accepted by the intended verified account.

An operator provisions `private.memberships`, separate `role_grants`, explicit `entitlements` and, for product owners, `owner_assignments`. Default roles/grants deny. Client admins are limited to same-org client_member invitations/revocations; admin promotions and entitlement grants remain organiser-controlled SQL operations in this build. `portal.admin`, `content.publish` and `broadcast.publish` are separate capability values with no private learning-read policy; operational/configuration UIs and content write APIs are not implemented.

## SMTP and callback URLs

Supabase's default mail service is restricted and is unsuitable for unrestricted magic-link testing. Configure custom SMTP/sending provider with approved sender domain, credentials, delivery limits and SPF/DKIM as required by that provider. That is an external account/security change requiring the user's approval; it was not performed here. A stored invitation is not a sent email. No smoke test automatically sends a magic link.

Set the Supabase Site URL to the intended origin and allow exact callback URLs:

- Local: `http://localhost:3000/auth/callback`.
- Approved production: `https://YOUR_APPROVED_DOMAIN/auth/callback`.
- If preview deployments are authorised, use only approved preview callback origins; avoid a broad wildcard for arbitrary sites.

Set server-only `APP_ORIGIN` to the exact origin without a trailing slash. Configure it separately for Development/Preview/Production. PKCE links must be opened in the originating browser context. Callback failures redirect to a clear sign-in retry. Verify link expiry, replay failure and sign-out with real accounts before release.

## Synthetic scenario

`supabase/seed.sql` is idempotent and never resets data or creates Auth users. Without mappings it inserts only three fictional clients, one synthetic employee organisation, catalogue/entitlements and a theme. To populate the scenario, an authorised operator maps four _existing legitimately verified distinct accounts_ in a SQL transaction using:

```sql
begin;
set local demo.client_a = 'YOUR_VERIFIED_CLIENT_A_UUID';
set local demo.client_b = 'YOUR_VERIFIED_CLIENT_B_UUID';
set local demo.client_c = 'YOUR_VERIFIED_CLIENT_C_UUID';
set local demo.employee = 'YOUR_VERIFIED_APPROVED_AZENTIO_EMPLOYEE_UUID';
-- Run the contents of supabase/seed.sql in this same session (omit its outer BEGIN/COMMIT when embedding).
commit;
```

Review the account/org/grant mapping before running: this is explicit demo provisioning by the organiser, not an application onboarding path. It gives client A same-org client admin capability and the approved employee moderation/idea-owner permissions. Existing revoked memberships are not re-enabled on rerun. Three published seasonality contributions, an amended clarification history, an outstanding clarification and an Under review Financial Analysis Intelligence idea are provided. All wording is synthetic. Confirm workspace membership before showing the scenario.

## Native Vercel source deployment

When separately authorised, connect the repository/branch through the user's Vercel project. Framework: Next.js. Node: 24.x (local exact version 24.22.2; Vercel manages its supported patch). Install: `npm ci`. Build: `npm run build`. No container deployment, static export, Express server or edge AWS runtime. The lockfile and `packageManager` pin npm; verify the deployment's actual Node/npm versions. `.env.local` is ignored and excluded from Docker context.

Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, APP_ORIGIN and server-only Bedrock variables through the appropriate Vercel environment settings. Public Supabase variables are build-time values; rebuild after changing them. Do not put AWS secrets in NEXT_PUBLIC variables, build args, images, Git or logs. No privileged DB key is required. AIRA is a Node route with a 30-second route duration, 15-second SDK abort signal and at most two attempts.

## Daily Bedrock credential rotation

Replace **BEDROCK_ACCESS_KEY_ID**, **BEDROCK_SECRET_ACCESS_KEY** and **BEDROCK_SESSION_TOKEN together** in the intended Vercel environment. Also set BEDROCK_REGION and a model/inference-profile ID supporting Converse and your permitted region/account. Permissions need the appropriate Bedrock model invocation resources. SDK credentials are passed explicitly; no host credential chain fallback occurs.

After replacement, redeploy the authorised environment, sign in as an approved entitled user and make a bounded `/api/aira` request. Confirm grounded citations and unavailable handling on expiry without printing credentials/provider errors. Redeployment does not reset token expiry. Copied session credentials do not renew themselves. Actual model, region and IAM permissions have not been verified because no credentials were configured for this task. The portal remains functional without AI.

## Release smoke tests

Before an approved main release: full offline suite/typecheck/build, then hosted multi-account tenant/role tests, verified magic-link callback and sign-out, revoked membership with an existing browser session, moderator draft denial, three-to-two cohort withdrawal, in-flight AIRA withdrawal and current-citation validation. Set only legitimate disposable test-account credentials locally for `npm run test:hosted`; it signs in by password and does not send email or mutate workflow data. Review external SMTP/provider behavior separately.

Run `docker compose config` and `docker compose up --build` with the configured hosted development environment. Check hot reload and named dependency/build cache volumes. A successful container does not prove Vercel compatibility. Docker daemon was stopped during this task, so image build/start/hot reload were not verified.

Production gaps include cross-process concurrency testing against hosted PostgreSQL/PostgREST, load/rate protection for Auth/AIRA/public forms, production CSP nonce adoption, retention/purge operations, accessibility audit with live identities, and the feature gaps in REQUIREMENTS_COVERAGE.md. Review provider logging and backups; do not log request bodies or private source/provider payloads.
