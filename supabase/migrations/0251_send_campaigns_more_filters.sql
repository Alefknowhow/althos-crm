alter table send_campaigns
  add column if not exists audience_status text[],
  add column if not exists audience_sources text[],
  add column if not exists audience_tier text,
  add column if not exists audience_has_email boolean,
  add column if not exists audience_has_phone boolean,
  add column if not exists audience_no_contact_days int,
  add column if not exists audience_created_from date,
  add column if not exists audience_created_to date,
  add column if not exists audience_value_min_cents bigint,
  add column if not exists audience_value_max_cents bigint;
