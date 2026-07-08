# Nexeire

A **self-serve** tool for small businesses. The entire product is one loop:

> **upload → generate → review/download**

A user signs up, fills in a short brand profile, uploads clips/photos of their
business, clicks **Generate**, and the app autonomously writes scripts and renders
finished short-form marketing videos that land in their video library to download.

> There is intentionally **no billing, credits, Stripe, agency/admin console, or
> manual script-approval step.** Those were deliberately removed (see
> `supabase/migrations/20260627000006_great_deletion_*`). Don't reintroduce them.

## Quick start

```bash
cp .env.example .env.local   # fill in the REQUIRED values (see below)
pnpm install
pnpm dev                     # http://127.0.0.1:3000
```

To just click through the UI without paid provider keys, set these in
`.env.local`:

```bash
SCRIPT_GENERATION_PROVIDER=fixture   # skip OpenAI
RENDER_PROVIDER=test                 # skip real render
```

## Environment variables

Full template with inline notes lives in [`.env.example`](./.env.example).

**Required to run the real product:**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for server actions + webhooks |
| `ADMIN_EMAILS` | Comma-separated admin allow-list |
| `OPENAI_API_KEY` | Script generation (skip with `SCRIPT_GENERATION_PROVIDER=fixture`) |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Voiceover |
| `REMOTION_PROGRESS_SECRET`, `VIDEO_WORKER_SECRET`, `CRON_SECRET` | Random strings guarding the internal API routes |

Everything else in `.env.example` is optional and already has a working default
in code (provider toggles, ElevenLabs/Remotion tuning, `APP_BASE_URL`, Agentation).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript
- **Supabase** — Postgres + Auth (SSR via `@supabase/ssr`) + Storage + RLS
- **Remotion** (`remotion`, `@remotion/player`, `@remotion/vercel`) for rendering
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) for script generation
- **Tailwind v4** + `radix-ui`; light "editorial" UI kit in `src/components/ui`

## Routes

Public: `/` (landing), `/login`, `/signup`, `/logout`.

Customer app (`src/app/app/*`) — sidebar is **Dashboard · Brand · Uploads · Videos**:

- `/app` — dashboard with the **Generate videos** button
- `/app/setup` — creates the organization, owner membership, starter brand profile
- `/app/brand` — chat-style intake saved into `brand_profiles` + `intake_messages`
- `/app/assets` — resumable (tus) uploads of private b-roll into Supabase Storage
- `/app/inbox` — the **Videos** library: ready/failed outputs, signed downloads, retry
- `/app/inbox/[videoOutputId]/trace` — per-video render trace

Internal API routes (secret-guarded):

- `POST /api/video-generation/worker` — kicks off queued render work
- `POST /api/render/remotion/progress` — polls in-flight renders, uploads finished
  MP4s to Storage, flips `video_outputs.status` to `ready`

## The flow, in code

The dashboard **Generate videos** button calls `generateVideosAction`
(`src/app/app/actions.ts`): it generates `campaign_scripts` (auto-accepted — no
review gate), creates a `campaigns` batch, then renders via
`startCampaignGeneration` → `processVideoOutput` → Remotion. Finished videos show
in `src/app/app/inbox/page.tsx`.

Mutations go through server actions in `src/app/app/actions.ts` (service-role
client); pages read with the SSR client under RLS.

## Data model (Supabase `public` schema)

Migrations live in `supabase/migrations/`. Apply them to your Supabase project
before running against real data.

**Tables:** `organizations`, `organization_members`, `brand_profiles`,
`intake_messages`, `organization_assets`, `research_reports`, `campaigns`,
`campaign_scripts`, `video_outputs`, `provider_jobs`, `provider_events`,
`provider_costs` (internal render telemetry), `admin_users`.

**Storage buckets** (private, served via time-limited signed URLs):
customer uploads and generated voiceovers/MP4s. Generated-media writes are
service-role/admin paths only.

## Verification

```bash
pnpm qa   # runs lint + typecheck + test + build
```

Or individually: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

There is a Playwright smoke spec in `e2e/`; run it with `pnpm test:e2e`. It uses
port `3100` by default (override with `PLAYWRIGHT_PORT`) so it won't collide with
a manual dev server on `3000`.

## Agentation visual feedback (optional, local dev)

Agentation is wired into the root layout. Enable the annotation toolbar with:

```bash
NEXT_PUBLIC_ENABLE_AGENTATION=true pnpm dev
```

For MCP-backed annotation syncing, run the Agentation MCP server separately and
point the toolbar at it via `NEXT_PUBLIC_AGENTATION_ENDPOINT`.
