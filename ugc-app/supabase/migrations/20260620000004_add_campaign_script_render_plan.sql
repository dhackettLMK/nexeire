alter table public.campaign_scripts
  add column if not exists render_plan jsonb;

comment on column public.campaign_scripts.render_plan is
  'User-edited Remotion render plan generated from the original AI scene_plan.';
