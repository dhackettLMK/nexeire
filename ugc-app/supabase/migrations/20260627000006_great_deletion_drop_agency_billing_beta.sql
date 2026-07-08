-- Great deletion: remove the agency console, user-facing billing, and the
-- beta-feedback program. The product is now self-serve only:
--   organizations -> brand_profiles -> organization_assets -> campaigns ->
--   campaign_scripts -> video_outputs (with research_reports / intake_messages).
--
-- Kept on purpose:
--   * provider_jobs / provider_events / provider_costs  (internal render telemetry)
--   * admin_users + app_private.is_admin()  (still referenced by the
--     "Admins can manage ..." RLS policies on the kept tables)
--
-- This migration is destructive and irreversible. The historical CREATE TABLE
-- migrations are intentionally left untouched.

-- 1. Drop billing columns on the kept campaigns table (this also removes the
--    foreign key into credit_reservations).
alter table public.campaigns
  drop column if exists credit_reservation_id,
  drop column if exists reserved_credits;

-- 2. User-facing billing: credits + Stripe. No financial infrastructure remains.
drop table if exists public.credit_reservations cascade;
drop table if exists public.credit_ledger cascade;
drop table if exists public.stripe_checkout_sessions cascade;
drop table if exists public.payments cascade;

-- 3. Beta-feedback program.
drop table if exists public.beta_feedback cascade;

-- 4. Legacy agency console (the Phase 1 "done-for-you" data model).
--    Children before parents for clarity; cascade handles the rest.
drop table if exists public.exports cascade;
drop table if exists public.script_variants cascade;
drop table if exists public.assets cascade;
drop table if exists public.briefs cascade;
drop table if exists public.clients cascade;
