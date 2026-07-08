alter table public.video_outputs
  drop constraint if exists video_outputs_source_check,
  add constraint video_outputs_source_check check (
    source in ('manual', 'automation', 'editor')
  );
