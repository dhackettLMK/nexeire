alter table public.briefs
  add column if not exists what_they_do text,
  add column if not exists why_they_do_it text,
  add column if not exists promoting text,
  add column if not exists main_pain_points text,
  add column if not exists offer_cta text,
  add column if not exists tone_examples text,
  add column if not exists summary_generated_at timestamptz,
  add column if not exists summary_model text;

comment on column public.briefs.what_they_do is 'Plain-language description of what the client business does.';
comment on column public.briefs.why_they_do_it is 'Founder or brand motivation behind the business.';
comment on column public.briefs.promoting is 'Specific service, product, offer, event, or campaign focus being promoted.';
comment on column public.briefs.main_pain_points is 'Customer pains, objections, or problems the content should speak to.';
comment on column public.briefs.offer_cta is 'Primary offer and call to action for this batch.';
comment on column public.briefs.tone_examples is 'Reference phrases, creators, brands, or copy examples that define the desired tone.';
comment on column public.briefs.summary_generated_at is 'Timestamp when the generated brand brief summary was last refreshed.';
comment on column public.briefs.summary_model is 'Model or fallback generator used for the latest generated summary.';
