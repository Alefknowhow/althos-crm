-- NPS (Net Promoter Score) por contato — pesquisa 0-10 disparada manualmente
-- ou por automação (step "Enviar pesquisa NPS", geralmente depois de um
-- step "Esperar N dias" a partir do trigger "Cliente convertido"). A
-- captura automática da resposta do WhatsApp fica pra depois (o pipeline de
-- ingestão está em refatoração); por enquanto a nota pode ser registrada
-- manualmente também.
alter table contatos
  add column if not exists nps_score smallint check (nps_score is null or (nps_score >= 0 and nps_score <= 10)),
  add column if not exists nps_status text not null default 'none' check (nps_status in ('none', 'aguardando', 'respondido')),
  add column if not exists nps_sent_at timestamptz,
  add column if not exists nps_responded_at timestamptz;
