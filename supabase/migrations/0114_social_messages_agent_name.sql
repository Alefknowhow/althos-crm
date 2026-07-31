-- Nome do atendente logado que enviou a mensagem manual — visível só no CRM
-- (não é enviado ao Instagram), pra controle interno de quem respondeu.
alter table public.social_messages
  add column if not exists sent_by_name text;
