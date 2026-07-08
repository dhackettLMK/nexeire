create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null default auth.uid(),
  status text not null default 'active' check (
    status in ('active', 'paused', 'archived')
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  email text,
  role text not null default 'owner' check (
    role in ('owner', 'admin', 'member')
  ),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_name text not null,
  website_url text,
  social_links text[] not null default '{}',
  location text,
  industry text,
  what_they_do text,
  why_they_do_it text,
  promoting text,
  target_customer text,
  main_pain_points text,
  offer_cta text,
  tone text,
  tone_examples text,
  raw_notes text,
  status text not null default 'draft' check (
    status in ('draft', 'complete', 'archived')
  ),
  unique (organization_id)
);

create table public.intake_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_profile_id uuid references public.brand_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null check (author in ('assistant', 'user')),
  prompt_key text not null,
  content text not null,
  sort_order integer not null default 0
);

create table public.video_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  status text not null default 'planned' check (
    status in ('planned', 'queued', 'generating', 'ready', 'failed', 'archived')
  ),
  source text not null default 'manual' check (
    source in ('manual', 'automation')
  ),
  thumbnail_path text,
  video_path text,
  notes text
);

create index organizations_owner_user_id_idx on public.organizations(owner_user_id);
create index organization_members_user_id_idx on public.organization_members(user_id);
create index organization_members_organization_id_idx on public.organization_members(organization_id);
create index brand_profiles_organization_id_idx on public.brand_profiles(organization_id);
create index intake_messages_organization_id_idx on public.intake_messages(organization_id, sort_order);
create index video_outputs_organization_id_idx on public.video_outputs(organization_id, updated_at desc);

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function app_private.set_updated_at();

create trigger set_brand_profiles_updated_at
before update on public.brand_profiles
for each row execute function app_private.set_updated_at();

create trigger set_video_outputs_updated_at
before update on public.video_outputs
for each row execute function app_private.set_updated_at();

create or replace function app_private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
  );
$$;

revoke all on function app_private.is_org_member(uuid) from public;
grant execute on function app_private.is_org_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.intake_messages enable row level security;
alter table public.video_outputs enable row level security;

create policy "Organization members can read organizations"
on public.organizations
for select
to authenticated
using (
  app_private.is_admin()
  or owner_user_id = auth.uid()
  or app_private.is_org_member(id)
);

create policy "Authenticated users can create owned organizations"
on public.organizations
for insert
to authenticated
with check (app_private.is_admin() or owner_user_id = auth.uid());

create policy "Organization owners can update organizations"
on public.organizations
for update
to authenticated
using (app_private.is_admin() or owner_user_id = auth.uid())
with check (app_private.is_admin() or owner_user_id = auth.uid());

create policy "Organization members can read memberships"
on public.organization_members
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Users can create their owner membership"
on public.organization_members
for insert
to authenticated
with check (
  app_private.is_admin()
  or (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.organizations
      where id = organization_id
        and owner_user_id = auth.uid()
    )
  )
);

create policy "Users can update their membership profile"
on public.organization_members
for update
to authenticated
using (app_private.is_admin() or user_id = auth.uid())
with check (app_private.is_admin() or user_id = auth.uid());

create policy "Organization members can manage brand profiles"
on public.brand_profiles
for all
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id))
with check (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Organization members can manage intake messages"
on public.intake_messages
for all
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id))
with check (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Organization members can read video outputs"
on public.video_outputs
for select
to authenticated
using (app_private.is_admin() or app_private.is_org_member(organization_id));

create policy "Admins can manage video outputs"
on public.video_outputs
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

grant select, insert, update on
  public.organizations,
  public.organization_members
to authenticated;

grant select, insert, update, delete on
  public.brand_profiles,
  public.intake_messages
to authenticated;

grant select on public.video_outputs to authenticated;
grant insert, update, delete on public.video_outputs to authenticated;

comment on table public.organizations is 'Customer workspaces for self-serve SaaS accounts.';
comment on table public.organization_members is 'Authenticated users attached to customer workspaces.';
comment on table public.brand_profiles is 'Structured business, offer, audience, and tone profile produced by onboarding intake.';
comment on table public.intake_messages is 'Chat-style onboarding transcript used to build the brand profile.';
comment on table public.video_outputs is 'Future generated video inbox records.';
