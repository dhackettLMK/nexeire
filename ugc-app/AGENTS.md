<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Nexeire — what this app is

A **self-serve** tool for small businesses. The entire product is one loop:

> **upload → generate → review/download.**

A user signs up, fills in a short brand profile, uploads clips/photos of their
business, clicks **Generate**, and the app autonomously writes scripts and renders
finished short-form marketing videos that land in their video library to download.

There is intentionally **no billing, no credits/tokens, no Stripe, no agency/admin
console, and no manual script-approval step.** Do not reintroduce any of those — they
were deliberately deleted (see `supabase/migrations/20260627000006_great_deletion_*`).

## Stack
- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript
- **Supabase** — Postgres + Auth (SSR via `@supabase/ssr`) + Storage + RLS. Live
  project ref: `zqrzmmzfwqodwpwtojgv` ("Nexeire").
- **Remotion** (`remotion`, `@remotion/player`, `@remotion/vercel`) for rendering
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) for script generation
- **Tailwind v4** + `radix-ui`; light "editorial" design system in `src/components/ui`

## The flow, in code
- Customer app: `src/app/app/*`. Sidebar nav is just **Dashboard · Brand · Uploads · Videos**.
- Onboarding writes a `brand_profiles` row; uploads stream to `organization_assets`
  via resumable tus upload (`src/lib/assets/client-upload.ts`) into private Storage.
- The dashboard **Generate videos** button calls `generateVideosAction`
  (`src/app/app/actions.ts`): it generates `campaign_scripts` (auto-accepted — no
  review gate), creates a `campaigns` batch, then renders via
  `startCampaignGeneration` → `processVideoOutput` → Remotion.
- `src/app/api/render/remotion/progress/route.ts` polls in-flight renders, uploads
  finished MP4s to Storage, and flips `video_outputs.status` to `ready`.
- Finished videos show in `src/app/app/inbox/page.tsx` (the **Videos** library) with
  download + retry.

## Data model (Supabase `public` schema)
**Kept:** `organizations`, `organization_members`, `brand_profiles`,
`intake_messages`, `organization_assets`, `research_reports`, `campaigns`,
`campaign_scripts`, `video_outputs`, `provider_jobs`, `provider_events`,
`provider_costs` (internal render telemetry), `admin_users` (+ `app_private.is_admin()`,
which still backs the "Admins can manage" RLS policies on the kept tables).

**Removed 2026-06-27:** the agency tables (`clients`, `briefs`, `assets`, `exports`,
`script_variants`, `payments`), billing (`credit_ledger`, `credit_reservations`,
`stripe_checkout_sessions`), and `beta_feedback`.

## Conventions
- Mutations go through server actions in `src/app/app/actions.ts` (service-role
  client); pages read with the SSR client under RLS.
- Reuse the primitives in `src/components/ui` (Card, Stat, Field, button helpers,
  PageHeader, EmptyState, ActionForm, toast) — don't hand-roll cards/inputs.
- Lucide icons can't cross the server→client boundary as props; pass a string key and
  resolve via a local map (see `src/app/app/app-nav.tsx`).
- Validation before changes: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  (this is `pnpm qa`). There are currently no e2e specs; the Playwright harness
  remains for future ones.
