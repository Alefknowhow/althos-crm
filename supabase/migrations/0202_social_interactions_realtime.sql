-- Instagram → Comentários (fila de resposta manual) escuta social_interactions
-- via Supabase Realtime, mas a tabela não tinha sido adicionada à publicação
-- supabase_realtime — o evento nunca chegava no client, só via F5 (nova
-- busca ao servidor). social_messages/social_conversations já estavam.
alter publication supabase_realtime add table social_interactions;
