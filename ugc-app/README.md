# Nexeire App

Public landing page plus the Phase 1 private fulfilment dashboard for manually
delivering client UGC packs. Phase 2 adds the customer SaaS shell for signup,
organization setup, brand intake, and a video inbox placeholder.

## Setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ADMIN_EMAILS` comma-separated list of allowed admin emails

Optional AI generation variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`, defaults to `gpt-5.4-mini` in the app code
- `SCRIPT_GENERATION_PROVIDER=openai`; set to `fixture` only for local/test workflows
- `RESEARCH_PROVIDER=openai`; set to `fixture` only for local/test workflows

Video automation variables:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`, defaults to `eleven_multilingual_v2`
- `ELEVENLABS_ESTIMATED_CENTS_PER_1K_CHARS`, defaults to `30`
- `RENDER_PROVIDER=creatomate`; set to `test` only for local/test workflows
- `CREATOMATE_API_KEY`
- `CREATOMATE_TEMPLATE_ID`
- `CREATOMATE_ESTIMATED_CENTS_PER_VIDEO`, defaults to `120`
- `CREATOMATE_WEBHOOK_SECRET`, shared token appended to Creatomate callback URLs and required by the webhook route
- `APP_BASE_URL`, used to build provider webhook URLs

Billing and webhook variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CREDIT_BUNDLE_CREDITS`, defaults to `10`
- `STRIPE_CREDIT_BUNDLE_AMOUNT_CENTS`, defaults to `4900`
- `SUPABASE_SERVICE_ROLE_KEY`, server-only key for provider webhooks

Optional local development variables:

- `NEXT_PUBLIC_ENABLE_AGENTATION=true` enables the Agentation annotation toolbar
- `NEXT_PUBLIC_AGENTATION_ENDPOINT`, optional Agentation MCP server endpoint,
  for example `http://localhost:4747`

## Agentation Visual Feedback

Agentation is already installed and wired into the root layout. To use it
locally:

```bash
NEXT_PUBLIC_ENABLE_AGENTATION=true pnpm dev
```

For MCP-backed annotation syncing, start the Agentation MCP server separately
and point the toolbar at it:

```bash
NEXT_PUBLIC_ENABLE_AGENTATION=true \
NEXT_PUBLIC_AGENTATION_ENDPOINT=http://localhost:4747 \
pnpm dev
```

Then run Agentation's MCP setup/doctor command in the agent environment you want
to connect.

## Step 2 Data Model

The initial Supabase data model lives in
`supabase/migrations/20260614000000_phase_1_minimal_data_model.sql`.

It creates:

- `admin_users`
- `clients`
- `briefs`
- `assets`
- `script_variants`
- `exports`
- `payments`
- private `client-assets` storage bucket

The dashboard is admin-only. The migration seeds
`tombyrne788@gmail.com` into `admin_users`; local route protection also uses
`ADMIN_EMAILS` from `.env.local`.

Public signup, automated voiceover/rendering, autoposting, and production
billing are added in later phases.

## Phase 2 Customer Shell

Customer accounts use Supabase Auth and live under `/app`.

- `/signup` creates a Supabase account.
- `/app/setup` creates the organization, owner membership, and starter brand profile.
- `/app/brand` saves the chat-style intake into structured `brand_profiles` fields and `intake_messages`.
- `/app/inbox` is an empty, data-backed inbox for future generated videos.

Admins still use `/admin` and must be listed in `ADMIN_EMAILS`.

## Step 3 Brand Brief Builder

The brand brief builder lives at `/admin/clients/:clientId/brief`.

It saves the manual intake fields needed for the first paid fulfilment workflow:

- what the client does
- why they do it
- location, website, and social links
- what they are promoting
- target customer
- main pain points
- offer and CTA
- tone direction and examples
- raw intake notes

The “Generate brief summary” action stores a Markdown summary on the latest
brief. If `OPENAI_API_KEY` is set, the server action uses the OpenAI Responses
API; otherwise it stores a structured local summary so the workflow can still be
tested without AI credentials.

## Step 5 Script Generator

The script workspace lives at `/admin/clients/:clientId/scripts`.

It uses the latest brief plus selected or tagged b-roll metadata to generate
three UGC script variants by default, or the brief batch size capped at 10. The
generator uses the Vercel AI SDK with OpenAI Responses, applies a versioned
`video-marketing` scriptwriting skill, and saves draft variants to
`script_variants` for manual editing, approval, rejection, or archiving.

## Complete MVP Workflow

The customer app under `/app` now supports the full self-serve beta loop:

- `/app/brand` captures the reusable brand profile.
- `/app/assets` uploads private b-roll clips with the rights confirmation
  "I own or have permission to use this footage.", generates thumbnails, stores
  manual tags, and creates signed preview/download URLs.
- `/app/research` ingests website and social URLs, stores citations, summarizes
  offer/audience/tone/competitors/objections, recommends UGC formats, and flags
  risky claims before rendering.
- `/app/scripts` generates 3-10 scripts per campaign from the internal UGC
  playbook, research, brand profile, and selected b-roll. Scripts include hook,
  voiceover, scene plan, suggested b-roll, CTA, caption, and hashtags. When all
  planned scripts in a campaign are explicitly approved for video, generation
  starts automatically.
- `/app/batches` reserves credits, enforces hard limits, starts generation, and
  shows batch/video progress. A planned batch only starts after enough scripts
  are approved for the requested batch size, and already-started batches use
  per-video retry controls instead of restarting provider work.
- `/app/inbox` shows ready and failed outputs, signed MP4 downloads, retry
  controls, approvals, dislikes, caption edits, new-hook requests, and
  regeneration requests.

Failed render attempts refund the attempt credit. Retrying a failed video
reserves a replacement credit before provider work starts, so retries cannot
double-refund or deliver successful videos without a credit reservation. Batch
reservation rows also track settled spent/refunded counts from current video
outcomes while the credit ledger remains the source of truth for balances.
Provider jobs/costs, credit ledger writes, credit reservation writes, and Stripe
checkout session writes are service-role/admin mutation paths; organization
members get read access to their own rows but cannot directly mutate these
billing/provider internals through the Supabase Data API.
Generated video output rows are also organization-readable but service-role or
admin mutable, so customers cannot directly forge ready videos, generated file
paths, or provider cost state outside the server actions/webhooks.
Campaign and generated script rows follow the same pattern: users can read their
own campaigns/scripts, while creation, status updates, and review-state edits go
through server actions or admin/service-role paths after organization
authorization.
Research report rows are organization-readable but service-role/admin mutable,
so risky-claim flags, citations, and research notes cannot be directly rewritten
through the Supabase Data API.
Beta feedback is append-only for organization members: users can read and submit
feedback for their organization, while edits/deletes stay on admin or
service-role paths.

The admin app adds `/admin/monitoring` for users, batches, failures, provider
jobs, provider cost ledger totals, beta feedback, and beta KPIs: time to
finished batch, script acceptance rate, render failure rate, cost per video,
repeat use, profitable completed-batch rate, and gross margin. It also
summarizes support burden from actionable beta feedback, retryable/exhausted
render failures, and failed provider jobs.

## Storage

The migrations configure private Supabase Storage buckets:

- `client-assets` for raw customer/admin assets. Customer uploads are scoped to
  `organizations/<organization_id>/...` and protected by Storage RLS.
- `generated-videos` for voiceovers and finished MP4s. Objects are private and
  served through time-limited signed URLs. Generated media writes are
  service-role/admin paths; organization members cannot upload, update, or
  delete generated video/voiceover objects directly.

## Provider Webhooks

Configure providers to call these URLs:

- Creatomate render webhook: `${APP_BASE_URL}/api/webhooks/creatomate`
- Stripe webhook: `${APP_BASE_URL}/api/webhooks/stripe`

Webhook handlers store provider events idempotently. Duplicate Stripe webhooks
do not double-credit accounts, and duplicate Creatomate render webhooks do not
corrupt ready videos. Provider cost estimates and completion costs are stored in
idempotent `provider_costs` rows for admin margin monitoring. Stripe credit
grants are keyed to the Checkout Session id, so even separate completed events
for the same session cannot add credits twice.

## Local Test Providers

Live provider credentials are required for production verification. For local
development without paid render credentials, use explicit test providers:

```bash
SCRIPT_GENERATION_PROVIDER=fixture
RESEARCH_PROVIDER=fixture
RENDER_PROVIDER=test
```

These modes are intended for tests and local demos only. Voiceovers always use
ElevenLabs and require `ELEVENLABS_API_KEY` plus `ELEVENLABS_VOICE_ID`.

For live-provider smoke verification, run the opt-in provider smoke command with
real keys and public HTTPS media URLs:

Before creating live renders, validate an exported Creatomate template JSON
against the app's modification contract:

```bash
MVP_CREATOMATE_TEMPLATE_CONTRACT_FILE=/path/to/creatomate-template.json \
pnpm creatomate:template-check -- --json
```

The template check expects vertical 9:16 dimensions, at least 720x1280 output,
and editable element names matching the render payload (`Broll-1`, `Broll-2`,
`Broll-3`, `Voiceover`, `Hook`, `Caption`, `CTA`, `Title`). It writes
`.context/evidence/mvp-creatomate-template-contract-<timestamp>.md` for provider
QA records, but it does not replace the live render/webhook/MP4 evidence below.

```bash
ELEVENLABS_API_KEY=<elevenlabs-api-key> \
ELEVENLABS_VOICE_ID=<voice-id> \
CREATOMATE_API_KEY=<creatomate-api-key> \
CREATOMATE_TEMPLATE_ID=<template-id> \
CREATOMATE_WEBHOOK_SECRET=<shared-callback-token> \
APP_BASE_URL=https://<public-staging-host> \
MVP_CREATOMATE_SMOKE_VOICEOVER_URL=https://<public-file>/voiceover.mp3 \
MVP_CREATOMATE_SMOKE_BROLL_URLS=https://<public-file>/clip-a.mp4,https://<public-file>/clip-b.mp4 \
MVP_LIVE_PROVIDER_SMOKE=1 \
pnpm provider:smoke -- --json
```

This performs a real ElevenLabs text-to-speech request and creates a real
Creatomate render using the configured 9:16 template and the same modification
keys as the app (`Broll-1`, `Broll-2`, `Broll-3`, `Voiceover`, `Hook`,
`Caption`, `CTA`, `Title`). It does not replace a full staging render/webhook
pass; record the resulting command output plus the finished render/webhook
evidence as `MVP_LIVE_PROVIDER_QA_EVIDENCE`.

After a finished render is available, inspect the final MP4 evidence with
`ffprobe` installed:

```bash
MVP_VIDEO_EVIDENCE_INPUT=https://<signed-or-public-final-mp4-url> \
MVP_VIDEO_VISUAL_QA_EVIDENCE="note: watched the downloaded render; captions, timing, and CTA are correct" \
pnpm mvp:video-evidence -- --json
```

`MVP_VIDEO_EVIDENCE_INPUT` can also be an existing local MP4 path. The command
checks that the file is downloadable/readable, has a video stream, has an audio
stream, is vertical 9:16 within tolerance, meets the minimum vertical
resolution, and respects the configured 5-60 second length limit. It writes
`.context/evidence/mvp-video-evidence-<timestamp>.md` and prints a value for
`MVP_LIVE_PROVIDER_QA_EVIDENCE`; `pnpm mvp:readiness` inspects generated video
evidence reports and only accepts reports whose live-provider result passed.

## Demo Seed

For a staging/local Supabase project with migrations applied, seed demo MVP data
for an authenticated user. To create or reuse a demo Supabase Auth user by email:

```bash
DEMO_OWNER_EMAIL=demo@example.com \
DEMO_OWNER_PASSWORD='<strong-demo-password>' \
pnpm seed:mvp-demo
```

To attach the seeded organization to an existing auth user instead:

```bash
DEMO_OWNER_USER_ID=<auth-user-uuid> \
DEMO_OWNER_EMAIL=demo@example.com \
pnpm seed:mvp-demo
```

`DEMO_OWNER_PASSWORD` is only needed when `DEMO_OWNER_USER_ID` is omitted. The
seed uses the Supabase service-role key to create the user with email confirmed;
if the email already exists, it reuses that user and refreshes its password to
the provided value for deterministic QA login.

The seed creates an organization, membership, complete brand profile, credits,
a ready research report, selected b-roll assets with private storage objects, a
campaign, approved scripts, ready and failed video outputs, provider cost rows,
and beta feedback for exercising the authenticated customer and admin monitoring
surfaces.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright uses port `3100` by default so it does not accidentally reuse a
manual dev server on `3000`. Set `PLAYWRIGHT_PORT` to override it, or set
`PLAYWRIGHT_REUSE_SERVER=1` only when you intentionally want to test an existing
server.

Authenticated MVP e2e QA is opt-in. After applying migrations and running
`pnpm seed:mvp-demo`, provide the seeded login for the customer workflow:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
E2E_AUTH_EMAIL=demo@example.com \
E2E_AUTH_PASSWORD='<strong-demo-password>' \
pnpm test:e2e -- e2e/authenticated-mvp.spec.ts
```

To verify the admin monitoring surface against the same seeded data, use an
admin-listed email. If `ADMIN_EMAILS` is not set, Playwright treats
`E2E_ADMIN_EMAIL` as the admin email for its dev server:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
E2E_ADMIN_EMAIL=demo@example.com \
E2E_ADMIN_PASSWORD='<strong-demo-password>' \
pnpm test:e2e -- e2e/admin-monitoring.spec.ts
```

When those env vars are absent, the authenticated specs are skipped and the
blank-env smoke tests still run.

To verify the 20-50 clip staging upload acceptance, point the authenticated e2e
run at a directory of realistic phone clips. The spec fails if the directory has
fewer than `MVP_MIN_STAGING_CLIPS`, more than `MVP_MAX_STAGING_CLIPS`, or no file
at least `MVP_LARGE_CLIP_MIN_MB` MB:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
E2E_AUTH_EMAIL=demo@example.com \
E2E_AUTH_PASSWORD='<strong-demo-password>' \
MVP_STAGING_CLIP_DIR=/path/to/staging-phone-clips \
pnpm test:e2e:staging-assets
```

This uploads every supported video file through `/app/assets`, confirms usage
rights, tags and selects each clip, then verifies signed preview/download URLs.

Stripe Checkout QA is also opt-in because it creates a real Stripe Checkout
Session. Use a Stripe test-mode key unless you intentionally want to hit live
Stripe:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
STRIPE_SECRET_KEY=<stripe-secret-key> \
E2E_AUTH_EMAIL=demo@example.com \
E2E_AUTH_PASSWORD='<strong-demo-password>' \
E2E_STRIPE_CHECKOUT=1 \
pnpm test:e2e:stripe
```

This verifies the authenticated credit purchase button creates a Checkout
Session and redirects to Stripe. A completed payment plus signed webhook delivery
still needs to be run in staging and recorded as `MVP_LIVE_STRIPE_QA_EVIDENCE`.

To verify the signed Stripe webhook delivery/accounting path against staging,
post a synthetic completed Checkout Session event to the public app webhook. Use
a disposable seeded organization because this mutates credits and checkout
session rows:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
STRIPE_WEBHOOK_SECRET=<webhook-secret> \
APP_BASE_URL=https://<public-staging-host> \
MVP_STRIPE_WEBHOOK_SMOKE=1 \
MVP_STRIPE_WEBHOOK_SMOKE_ORGANIZATION_ID=<organization-uuid> \
pnpm stripe:webhook-smoke -- --json
```

The smoke command signs the payload with `STRIPE_WEBHOOK_SECRET`, posts it to
`/api/webhooks/stripe`, then verifies the `provider_events`,
`stripe_checkout_sessions`, and `credit_ledger` rows created by the webhook. It
proves webhook delivery and idempotent accounting in staging, but it does not
replace evidence of a real successful Stripe Checkout payment.

Run the full customer loop against a Supabase project after applying migrations
and configuring provider credentials. Live verification requires OpenAI,
ElevenLabs, Creatomate, Stripe, and Supabase Storage credentials.

To run the repeatable staged technical QA bundle and write an evidence report,
first inspect the required env without making provider or Stripe calls:

```bash
pnpm mvp:staging-qa -- --dry-run --json
```

When the dry run shows every task ready, run the gated command:

```bash
MVP_STAGING_QA=1 pnpm mvp:staging-qa -- --json
```

The runner executes authenticated customer/admin e2e, staging asset upload e2e,
Stripe Checkout e2e, live provider smoke, and signed Stripe webhook smoke. It
writes `.context/evidence/mvp-staging-qa-<timestamp>.md` and prints evidence
values that can be used for `MVP_AUTHENTICATED_QA_EVIDENCE`,
`MVP_LIVE_PROVIDER_QA_EVIDENCE`, and `MVP_LIVE_STRIPE_QA_EVIDENCE`. Paying beta
customer evidence and profitable-delivery evidence still require separate
business records.

To generate the beta customer/profitability evidence report from staging data,
use the Supabase service role against a project with real completed Checkout
Sessions, completed campaigns, ready videos, and provider costs:

```bash
NEXT_PUBLIC_SUPABASE_URL=<project-url> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
pnpm mvp:beta-evidence -- --json
```

The report writes `.context/evidence/mvp-beta-evidence-<timestamp>.md`, counts
paying organizations that completed the full flow, calculates completed-campaign
profitability from recognized credit revenue and persisted campaign costs, and
prints values for `MVP_BETA_CUSTOMER_EVIDENCE` and
`MVP_PROFITABILITY_EVIDENCE`.

Before claiming MVP readiness, run:

```bash
pnpm mvp:readiness -- --clip-dir=/path/to/staging-phone-clips
```

The readiness check fails until live provider/payment env vars are configured, a
20-50 clip staging set with at least one large clip is present, and the
authenticated QA, live provider, live Stripe, and paying-beta-customer evidence
variables are recorded. Profitability is tracked separately with
`MVP_PROFITABILITY_EVIDENCE`, using the admin monitoring profitable-batch and
gross-margin metrics as the recommended source. Evidence variables must be a
URL, an existing local file/directory path, or a `note:<summary>` value.
