-- Resumo estruturado que a IA gera pro atendente humano quando transfere
-- uma conversa (handoff) — seção 15 do documento de reestruturação do
-- módulo de IA. Fica na própria conversa (não é uma mensagem, não vai
-- pro WhatsApp) e é limpo manualmente pelo atendente depois de ler.
alter table public.whatsapp_conversations
  add column if not exists ai_handoff_summary text;

alter table public.whatsapp_conversations
  add column if not exists ai_handoff_at timestamptz;
