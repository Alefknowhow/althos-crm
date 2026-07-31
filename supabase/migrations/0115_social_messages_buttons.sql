-- Registra os botões (resposta rápida / link) enviados junto de uma
-- mensagem de automação, pra aparecerem no histórico do inbox do CRM —
-- hoje só o texto era salvo, então um passo com botão parecia "sem botão".
alter table public.social_messages
  add column if not exists buttons jsonb;
