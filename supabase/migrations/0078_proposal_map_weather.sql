-- Dynamic map + weather ("Clima") settings on travel proposals (cotações).
--
-- map_config: controls the interactive map shown on the public proposal.
--   { "enabled": bool, "query": string }  -- query overrides the auto destination lookup.
-- weather: powers the new "Clima" tab on the public proposal.
--   { "enabled": bool, "temp_min": string, "temp_max": string,
--     "summary": string, "seasonality": string, "expect": string }
--
-- Both are jsonb with a sane default so existing rows render with the map ON
-- (previous behaviour) and the weather tab OFF until the agent fills it in.

alter table public.travel_proposals
  add column if not exists map_config jsonb not null default '{"enabled": true}'::jsonb,
  add column if not exists weather    jsonb not null default '{"enabled": false}'::jsonb;

comment on column public.travel_proposals.map_config is
  'Public proposal map settings: { enabled, query }. query overrides the auto destination lookup.';
comment on column public.travel_proposals.weather is
  'Public proposal "Clima" tab content: { enabled, temp_min, temp_max, summary, seasonality, expect }.';
