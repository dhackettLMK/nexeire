create or replace function app_private.storage_path_organization_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);

  if array_length(parts, 1) < 2 then
    return null;
  end if;

  if parts[1] <> 'organizations' then
    return null;
  end if;

  if parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return parts[2]::uuid;
end;
$$;

revoke all on function app_private.storage_path_organization_id(text) from public;
grant execute on function app_private.storage_path_organization_id(text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'generated-videos',
  'generated-videos',
  false,
  1073741824,
  array[
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.briefs
  drop constraint if exists briefs_batch_size_check,
  add constraint briefs_batch_size_check check (batch_size between 1 and 10);

alter table public.briefs
  drop constraint if exists briefs_duration_seconds_check,
  add constraint briefs_duration_seconds_check check (duration_seconds between 5 and 60);

alter table public.script_variants
  add column if not exists suggested_broll jsonb not null default '[]'::jsonb,
  add column if not exists cta text;

create table public.organization_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_by uuid default auth.uid(),
  storage_bucket text not null default 'client-assets',
  storage_path text not null,
  thumbnail_path text,
  filename text not null,
  content_type text,
  size_bytes bigint,
  duration_seconds numeric,
  tags text[] not null default '{}',
  ai_tags jsonb not null default '{}'::jsonb,
  notes text,
  rights_confirmed boolean not null default false,
  selected boolean not null default false,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'tagged', 'selected', 'archived')
  ),
  unique (storage_bucket, storage_path)
);

create table public.research_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  website_url text,
  social_urls text[] not null default '{}',
  offer text,
  audience text,
  tone text,
  competitors text[] not null default '{}',
  likely_objections text[] not null default '{}',
  recommended_formats text[] not null default '{}',
  citations jsonb not null default '[]'::jsonb,
  notes text,
  risky_claims text[] not null default '{}',
  raw_snapshot jsonb not null default '{}'::jsonb,
  model text,
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'failed', 'archived')
  ),
  error_message text
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  research_report_id uuid references public.research_reports(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  goal text,
  batch_size integer not null default 3 check (batch_size between 3 and 10),
  video_length_seconds integer not null default 30 check (video_length_seconds between 5 and 60),
  status text not null default 'queued' check (
    status in ('queued', 'scripting', 'voiceover', 'rendering', 'ready', 'failed', 'needs_review')
  ),
  admin_review_required boolean not null default false,
  credit_reservation_id uuid,
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents integer not null default 0 check (actual_cost_cents >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text
);

create table public.campaign_scripts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  format text not null,
  hook text not null,
  voiceover text not null,
  scene_plan jsonb not null default '[]'::jsonb,
  suggested_broll jsonb not null default '[]'::jsonb,
  cta text not null,
  caption text not null,
  hashtags text[] not null default '{}',
  editor_notes text,
  risk_flags text[] not null default '{}',
  review_status text not null default 'needs_review' check (
    review_status in ('needs_review', 'usable', 'needs_edit', 'unusable', 'approved', 'archived')
  ),
  version integer not null default 1 check (version > 0)
);

alter table public.video_outputs
  drop constraint if exists video_outputs_status_check,
  add constraint video_outputs_status_check check (
    status in ('planned', 'queued', 'scripting', 'voiceover', 'rendering', 'ready', 'failed', 'needs_review', 'archived')
  );

alter table public.video_outputs
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists campaign_script_id uuid references public.campaign_scripts(id) on delete set null,
  add column if not exists storage_bucket text not null default 'generated-videos',
  add column if not exists provider text,
  add column if not exists provider_render_id text,
  add column if not exists voiceover_path text,
  add column if not exists caption text,
  add column if not exists cta text,
  add column if not exists aspect_ratio text not null default '9:16',
  add column if not exists duration_seconds integer,
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists max_retries integer not null default 2 check (max_retries between 0 and 5),
  add column if not exists cost_estimate_cents integer not null default 0 check (cost_estimate_cents >= 0),
  add column if not exists actual_cost_cents integer not null default 0 check (actual_cost_cents >= 0),
  add column if not exists error_message text,
  add column if not exists ready_at timestamptz;

create table public.provider_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  video_output_id uuid references public.video_outputs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null,
  job_type text not null check (job_type in ('scripting', 'voiceover', 'render')),
  provider_job_id text,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'canceled')
  ),
  attempt integer not null default 1 check (attempt > 0),
  max_retries integer not null default 2 check (max_retries between 0 and 5),
  idempotency_key text not null unique,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents integer not null default 0 check (actual_cost_cents >= 0),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  status text not null default 'received' check (
    status in ('received', 'processed', 'ignored', 'failed')
  ),
  error_message text,
  unique (provider, provider_event_id)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  event_type text not null check (
    event_type in ('purchase', 'admin_adjustment', 'reservation', 'spend', 'refund', 'release')
  ),
  amount integer not null check (amount <> 0),
  source_type text,
  source_ref text,
  idempotency_key text not null unique,
  status text not null default 'posted' check (status in ('posted', 'void')),
  metadata jsonb not null default '{}'::jsonb
);

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  credits_reserved integer not null check (credits_reserved > 0),
  credits_spent integer not null default 0 check (credits_spent >= 0),
  credits_refunded integer not null default 0 check (credits_refunded >= 0),
  status text not null default 'reserved' check (
    status in ('reserved', 'settled', 'refunded', 'released')
  ),
  idempotency_key text not null unique
);

alter table public.campaigns
  add constraint campaigns_credit_reservation_id_fkey
  foreign key (credit_reservation_id)
  references public.credit_reservations(id)
  on delete set null;

create table public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_session_id text not null unique,
  status text not null default 'open',
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur',
  url text,
  expires_at timestamptz,
  completed_at timestamptz
);

create table public.provider_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  video_output_id uuid references public.video_outputs(id) on delete set null,
  provider_job_id uuid references public.provider_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  provider text not null,
  cost_type text not null check (cost_type in ('estimate', 'actual')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur',
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb
);

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  video_output_id uuid references public.video_outputs(id) on delete cascade,
  campaign_script_id uuid references public.campaign_scripts(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  feedback_type text not null check (
    feedback_type in ('approve', 'dislike', 'caption_edit', 'new_hook_request', 'regenerate_request')
  ),
  caption text,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index organization_assets_organization_id_idx on public.organization_assets(organization_id, created_at desc);
create index organization_assets_status_idx on public.organization_assets(organization_id, status);
create index research_reports_organization_id_idx on public.research_reports(organization_id, updated_at desc);
create index campaigns_organization_id_idx on public.campaigns(organization_id, updated_at desc);
create index campaigns_status_idx on public.campaigns(status);
create index campaign_scripts_campaign_id_idx on public.campaign_scripts(campaign_id, created_at);
create index campaign_scripts_organization_id_idx on public.campaign_scripts(organization_id, review_status);
create index video_outputs_campaign_id_idx on public.video_outputs(campaign_id, updated_at desc);
create index video_outputs_campaign_script_id_idx on public.video_outputs(campaign_script_id);
create index provider_jobs_video_output_id_idx on public.provider_jobs(video_output_id, created_at desc);
create index provider_jobs_campaign_id_idx on public.provider_jobs(campaign_id, created_at desc);
create index provider_jobs_provider_job_id_idx on public.provider_jobs(provider, provider_job_id);
create index credit_ledger_organization_id_idx on public.credit_ledger(organization_id, created_at desc);
create index credit_reservations_campaign_id_idx on public.credit_reservations(campaign_id);
create index stripe_checkout_sessions_organization_id_idx on public.stripe_checkout_sessions(organization_id, created_at desc);
create index provider_costs_campaign_id_idx on public.provider_costs(campaign_id, created_at desc);
create index provider_costs_video_output_id_idx on public.provider_costs(video_output_id, cost_type);
create index beta_feedback_organization_id_idx on public.beta_feedback(organization_id, created_at desc);

create trigger set_organization_assets_updated_at
before update on public.organization_assets
for each row execute function app_private.set_updated_at();

create trigger set_research_reports_updated_at
before update on public.research_reports
for each row execute function app_private.set_updated_at();

create trigger set_campaigns_updated_at
before update on public.campaigns
for each row execute function app_private.set_updated_at();

create trigger set_campaign_scripts_updated_at
before update on public.campaign_scripts
for each row execute function app_private.set_updated_at();

create trigger set_provider_jobs_updated_at
before update on public.provider_jobs
for each row execute function app_private.set_updated_at();

create trigger set_credit_reservations_updated_at
before update on public.credit_reservations
for each row execute function app_private.set_updated_at();

create trigger set_stripe_checkout_sessions_updated_at
before update on public.stripe_checkout_sessions
for each row execute function app_private.set_updated_at();

alter table public.organization_assets enable row level security;
alter table public.research_reports enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_scripts enable row level security;
alter table public.provider_jobs enable row level security;
alter table public.provider_events enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.stripe_checkout_sessions enable row level security;
alter table public.provider_costs enable row level security;
alter table public.beta_feedback enable row level security;

create policy "Organization members can manage organization assets"
on public.organization_assets
for all
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id))
with check (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Organization members can read research reports"
on public.research_reports
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage research reports"
on public.research_reports
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read campaigns"
on public.campaigns
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage campaigns"
on public.campaigns
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read campaign scripts"
on public.campaign_scripts
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage campaign scripts"
on public.campaign_scripts
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Organization members can read video outputs"
on public.video_outputs;

create policy "Organization members can read video outputs"
on public.video_outputs
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

drop policy if exists "Admins can manage video outputs"
on public.video_outputs;

create policy "Admins can manage video outputs"
on public.video_outputs
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read provider jobs"
on public.provider_jobs
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage provider jobs"
on public.provider_jobs
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage provider events"
on public.provider_events
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read credit ledger"
on public.credit_ledger
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage credit ledger"
on public.credit_ledger
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read credit reservations"
on public.credit_reservations
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage credit reservations"
on public.credit_reservations
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read stripe checkout sessions"
on public.stripe_checkout_sessions
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage stripe checkout sessions"
on public.stripe_checkout_sessions
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read provider costs"
on public.provider_costs
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage provider costs"
on public.provider_costs
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read beta feedback"
on public.beta_feedback
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Organization members can submit beta feedback"
on public.beta_feedback
for insert
to authenticated
with check (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage beta feedback"
on public.beta_feedback
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Organization members can read scoped storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('client-assets', 'generated-videos')
  and (
    app_private.is_admin()
    or app_private.is_org_member(app_private.storage_path_organization_id(name))
  )
);

create policy "Organization members can upload client asset storage objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-assets'
  and (
    app_private.is_admin()
    or app_private.is_org_member(app_private.storage_path_organization_id(name))
  )
);

create policy "Organization members can update client asset storage objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-assets'
  and (
    app_private.is_admin()
    or app_private.is_org_member(app_private.storage_path_organization_id(name))
  )
)
with check (
  bucket_id = 'client-assets'
  and (
    app_private.is_admin()
    or app_private.is_org_member(app_private.storage_path_organization_id(name))
  )
);

create policy "Organization members can delete client asset storage objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-assets'
  and (
    app_private.is_admin()
    or app_private.is_org_member(app_private.storage_path_organization_id(name))
  )
);

create policy "Admins can manage generated media storage objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'generated-videos'
  and app_private.is_admin()
)
with check (
  bucket_id = 'generated-videos'
  and app_private.is_admin()
);

grant select, insert, update, delete on
  public.organization_assets,
  public.research_reports,
  public.campaigns,
  public.campaign_scripts,
  public.provider_jobs,
  public.provider_events,
  public.credit_ledger,
  public.credit_reservations,
  public.stripe_checkout_sessions,
  public.provider_costs,
  public.beta_feedback
to authenticated;

comment on table public.organization_assets is 'Customer-owned b-roll and raw creative assets stored in private Supabase Storage.';
comment on table public.research_reports is 'Grounded website/social research summaries, citations, and risky claim flags.';
comment on table public.campaigns is 'Customer UGC generation batches from scripting through rendered video delivery.';
comment on table public.campaign_scripts is 'Generated and reviewed scripts that feed video automation.';
comment on table public.provider_jobs is 'Voiceover, render, and scripting provider jobs with retry and cost state.';
comment on table public.provider_events is 'Idempotency ledger for Stripe, Creatomate, and other provider webhooks.';
comment on table public.credit_ledger is 'Source-of-truth credit balance ledger. Balance is the sum of posted amounts.';
comment on table public.credit_reservations is 'Batch-level credit reservations and refunds.';
comment on table public.provider_costs is 'Estimated and actual provider costs for admin margin monitoring.';
comment on table public.beta_feedback is 'Beta user approvals, dislikes, caption edits, hook requests, and regeneration requests.';
