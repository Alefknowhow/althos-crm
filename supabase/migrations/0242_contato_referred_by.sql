-- Origem "Indicação" com registro de quem indicou — aponta pra outro
-- contato já cadastrado (referred_by_contato_id) com fallback em texto
-- livre (referred_by_name) quando quem indicou não está no CRM.
alter table contatos
  add column if not exists referred_by_contato_id uuid references contatos(id) on delete set null,
  add column if not exists referred_by_name text;

create index if not exists idx_contatos_referred_by_contato_id on contatos(referred_by_contato_id) where referred_by_contato_id is not null;
