-- Conversas (WhatsApp) e Instagram nunca atualizavam ao vivo — o código
-- client-side já assinava `postgres_changes` nessas 4 tabelas há tempos,
-- mas sem elas estarem na publicação `supabase_realtime` o Postgres nunca
-- replica as mudanças, então a assinatura fica escutando um evento que
-- nunca chega (sem erro nenhum, silenciosamente). Por isso era preciso
-- dar F5 pra ver mensagem nova.

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE social_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE social_conversations;
