-- Internal-only fields on travel proposals (cotações).
--
-- "Operadora" (tour operator) and "Comissão total" (total commission) are for
-- the internal team only. They are NEVER rendered on the public proposal/PDF
-- (/p/[token]) — only inside the authenticated ProposalBuilder.
--
-- commission_total_cents stores money as integer cents, matching total_cents.

alter table public.travel_proposals
  add column if not exists operadora               text,
  add column if not exists commission_total_cents  integer not null default 0;

comment on column public.travel_proposals.operadora is
  'Internal-only: tour operator (operadora) for this quote. Not shown on the public proposal.';
comment on column public.travel_proposals.commission_total_cents is
  'Internal-only: total commission in cents. Not shown on the public proposal.';
