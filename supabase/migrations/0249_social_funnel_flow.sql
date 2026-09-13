alter table social_funnel_steps add column if not exists client_id text;
alter table social_funnels add column if not exists flow jsonb;
