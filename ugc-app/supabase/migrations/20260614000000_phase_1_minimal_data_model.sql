create schema if not exists app_private;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.admin_users (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.admin_users (email)
values ('tombyrne788@gmail.com')
on conflict (email) do nothing;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function app_private.is_admin() from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_admin() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  business_name text not null,
  website_url text,
  social_links text[] not null default '{}',
  location text,
  industry text,
  offer text,
  target_customer text,
  tone text,
  notes text,
  status text not null default 'lead' check (
    status in ('lead', 'briefing', 'assets', 'scripting', 'editing', 'delivered', 'archived')
  )
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  campaign_goal text,
  platform text not null default 'short_form',
  duration_seconds integer not null default 30 check (duration_seconds between 5 and 90),
  batch_size integer not null default 3 check (batch_size between 1 and 50),
  raw_notes text,
  generated_summary text,
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'approved', 'archived')
  )
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  brief_id uuid references public.briefs(id) on delete set null,
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
  notes text,
  rights_confirmed boolean not null default false,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'tagged', 'selected', 'archived')
  ),
  unique (storage_bucket, storage_path)
);

create table public.script_variants (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text,
  format text,
  hook text,
  voiceover text,
  scene_plan jsonb not null default '[]'::jsonb,
  caption text,
  hashtags text[] not null default '{}',
  editor_notes text,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'rejected', 'archived')
  ),
  version integer not null default 1 check (version > 0)
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  export_format text not null default 'markdown' check (
    export_format in ('markdown', 'text')
  ),
  export_content text,
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'archived')
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_customer_id text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'unpaid' check (
    status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')
  ),
  notes text
);

create index clients_created_at_idx on public.clients(created_at desc);
create index clients_status_idx on public.clients(status);
create index briefs_client_id_idx on public.briefs(client_id);
create index assets_client_id_idx on public.assets(client_id);
create index assets_brief_id_idx on public.assets(brief_id);
create index script_variants_brief_id_idx on public.script_variants(brief_id);
create index exports_brief_id_idx on public.exports(brief_id);
create index payments_client_id_idx on public.payments(client_id);

create trigger set_clients_updated_at
before update on public.clients
for each row execute function app_private.set_updated_at();

create trigger set_briefs_updated_at
before update on public.briefs
for each row execute function app_private.set_updated_at();

create trigger set_assets_updated_at
before update on public.assets
for each row execute function app_private.set_updated_at();

create trigger set_script_variants_updated_at
before update on public.script_variants
for each row execute function app_private.set_updated_at();

create trigger set_exports_updated_at
before update on public.exports
for each row execute function app_private.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function app_private.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.clients enable row level security;
alter table public.briefs enable row level security;
alter table public.assets enable row level security;
alter table public.script_variants enable row level security;
alter table public.exports enable row level security;
alter table public.payments enable row level security;

create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (app_private.is_admin());

create policy "Admins can manage clients"
on public.clients
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage briefs"
on public.briefs
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage assets"
on public.assets
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage script variants"
on public.script_variants
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage exports"
on public.exports
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can manage payments"
on public.payments
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

grant usage on schema public to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on
  public.clients,
  public.briefs,
  public.assets,
  public.script_variants,
  public.exports,
  public.payments
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'client-assets',
  'client-assets',
  false,
  536870912,
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read client assets"
on storage.objects
for select
to authenticated
using (bucket_id = 'client-assets' and app_private.is_admin());

create policy "Admins can upload client assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'client-assets' and app_private.is_admin());

create policy "Admins can update client assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'client-assets' and app_private.is_admin())
with check (bucket_id = 'client-assets' and app_private.is_admin());

create policy "Admins can delete client assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'client-assets' and app_private.is_admin());
