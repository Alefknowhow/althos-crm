-- Simplifica o NPS: o disparo da pesquisa passou a exigir sempre um
-- template aprovado (não é mais rastreado por status "aguardando" —
-- ver lib/nps/send-survey.ts / actions/contatos-customers.ts), e a leitura
-- automática da resposta ainda não existe. Fica só a nota (registrada
-- manualmente) + quando ela foi atualizada pela última vez.
alter table contatos
  add column if not exists nps_updated_at timestamptz;

update contatos set nps_updated_at = coalesce(nps_responded_at, nps_sent_at)
  where nps_score is not null and nps_updated_at is null;

alter table contatos
  drop column if exists nps_status,
  drop column if exists nps_sent_at,
  drop column if exists nps_responded_at;
