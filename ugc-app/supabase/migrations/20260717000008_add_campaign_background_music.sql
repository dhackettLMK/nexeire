alter table public.campaigns
  add column if not exists music_track_id text;

comment on column public.campaigns.music_track_id is
  'Curated instrumental track id (see src/lib/videos/music-library.ts) played quietly under the voiceover, or null for no music.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'music-library',
  'music-library',
  true,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can manage music library storage objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'music-library'
  and app_private.is_admin()
)
with check (
  bucket_id = 'music-library'
  and app_private.is_admin()
);
