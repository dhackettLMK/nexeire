-- Campaign generation supports one-off videos, so keep the database constraint
-- aligned with the app-level batch-size rules.
alter table public.campaigns
  drop constraint if exists campaigns_batch_size_check,
  add constraint campaigns_batch_size_check check (batch_size between 1 and 10);
