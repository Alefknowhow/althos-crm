-- Resumo diário por e-mail (Configurações > Notificações) — liga/desliga
-- por organização; enviado pro owner/admin da org todo dia às 7h (horário
-- de Brasília) com tarefas em atraso/do dia e embarques do dia/da semana.
alter table public.org_settings
  add column if not exists digest_enabled boolean not null default false;
