alter table public.organizations
  add column logo_path text;

comment on column public.organizations.logo_path is
  'Storage path (client-assets bucket) to the workspace''s uploaded brand logo, shown in place of the initial avatar in the app shell.';
