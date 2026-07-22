alter table public.campaigns
  add column if not exists music_volume real
  check (music_volume is null or (music_volume >= 0 and music_volume <= 1));

comment on column public.campaigns.music_volume is
  'Background music playback volume as a 0-1 fraction (dashboard knob, 10% steps). Null when no music track is selected.';
