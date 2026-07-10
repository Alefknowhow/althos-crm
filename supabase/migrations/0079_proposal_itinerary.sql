-- Roteiro rico opcional na proposta pública.
-- Shape: { enabled: boolean, html: string }
alter table public.travel_proposals
  add column if not exists itinerary jsonb not null default '{"enabled": false}'::jsonb;

comment on column public.travel_proposals.itinerary is
  'Public proposal "Roteiro" section: { enabled, html }. Rich text (TipTap HTML) authored in the builder.';
