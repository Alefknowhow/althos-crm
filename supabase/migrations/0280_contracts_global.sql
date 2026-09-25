-- Issue #16 — módulo global de Contratos, fonte única de verdade,
-- reutilizável por qualquer entidade (Reserva, Venda, Oportunidade,
-- Cliente, Projeto, ou nenhuma).
--
-- Escopo deliberadamente ADITIVO: `sale_contracts` (Reservas/Viagens) e
-- `plan_contracts` (Agências de Tráfego) continuam existindo, funcionando
-- exatamente como hoje, com o mesmo webhook da Autentique que já roda em
-- produção. Migrar esses ~13-15 arquivos e os contratos já assinados pra
-- dentro desta tabela nova é trabalho de uma issue de continuação — auditoria
-- prévia (ver docs/audit) mostrou que uma tentativa anterior de generalizar
-- sale_contracts (sales_generic_id, migration 0192) foi revertida (0194)
-- depois de já ter ido pra produção; não repetir esse padrão de risco.
--
-- `contracts` é o destino de contratos criados a partir de AGORA pelo módulo
-- global novo (sidebar → Contratos) — Vendas/Oportunidades/Clientes/Projetos
-- não tinham NENHUM lugar pra contrato hoje, então isso não compete com nada
-- existente.
create table if not exists public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  title                 text not null,
  status                text not null default 'draft'
                          check (status in ('draft','ready','sent','viewed','awaiting_signature','signed','rejected','expired','cancelled')),
  -- Relacionamento polimórfico (issue #16 §5) — sem FK de banco (exigiria
  -- uma FK por tipo de entidade), validado na aplicação. Null = contrato
  -- independente, sem vínculo.
  related_entity_type   text check (related_entity_type in ('reserva','venda','oportunidade','cliente','projeto')),
  related_entity_id     uuid,
  template_id           uuid references public.document_templates(id) on delete set null,
  -- Snapshot do documento efetivamente gerado — nunca recalculado a partir
  -- do template depois de gerado (mesma regra de "não alterar
  -- retroativamente" já usada em Catálogo/Vendas nesta mesma leva de issues).
  body_html             text,
  field_values          jsonb not null default '{}'::jsonb,
  value_cents           integer,
  responsible_id        uuid, -- membership/profile responsável, sem FK cross-schema (auth.users)
  pdf_path              text,
  signed_pdf_path       text,
  autentique_document_id text,
  signature_link        text,
  sent_at               timestamptz,
  signed_at             timestamptz,
  cancelled_at          timestamptz,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists idx_contracts_autentique_doc
  on public.contracts(autentique_document_id) where autentique_document_id is not null;
create index if not exists idx_contracts_org on public.contracts(organization_id);
create index if not exists idx_contracts_org_status on public.contracts(organization_id, status);
create index if not exists idx_contracts_related_entity on public.contracts(related_entity_type, related_entity_id);

drop trigger if exists update_contracts_updated_at on public.contracts;
create trigger update_contracts_updated_at
before update on public.contracts
for each row execute procedure update_updated_at_column();

alter table public.contracts enable row level security;
create policy "org members access contracts" on public.contracts
  for all using (organization_id in (select get_user_organizations()));

-- Signatários — tabela filha desde o início (N signatários), diferente de
-- sale_contracts/plan_contracts que hardcodam signer/signer2 em colunas
-- fixas. Pessoa existente no CRM (contato_id) OU informada manualmente
-- (nome/e-mail/telefone/documento direto na linha) — issue #16 §6.
create table if not exists public.contract_signers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  contract_id       uuid not null references public.contracts(id) on delete cascade,
  contato_id        uuid references public.contatos(id) on delete set null,
  name              text not null,
  email             text,
  phone             text,
  document_number   text, -- CPF/CNPJ, quando exigido pelo provedor/documento
  sort_order        integer not null default 0,
  status            text not null default 'pending' check (status in ('pending','sent','signed','rejected')),
  signed_at         timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_contract_signers_contract on public.contract_signers(contract_id);
create index if not exists idx_contract_signers_org on public.contract_signers(organization_id);

alter table public.contract_signers enable row level security;
create policy "org members access contract_signers" on public.contract_signers
  for all using (organization_id in (select get_user_organizations()));

-- Timeline de eventos (issue #16 §10) — histórico legível, separado dos
-- campos de estado atual acima (que só guardam o estado MAIS RECENTE).
create table if not exists public.contract_events (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  type          text not null, -- contract.created/generated/sent/viewed/signed/rejected/expired/cancelled (issue #16 §16)
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_contract_events_contract on public.contract_events(contract_id, created_at);

alter table public.contract_events enable row level security;
create policy "org members access contract_events" on public.contract_events
  for all using (organization_id in (select get_user_organizations()));
