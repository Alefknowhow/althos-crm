-- Descoberto ao investigar por que um direct do Instagram não aparecia no
-- CRM: duas orgs diferentes tinham uma conexão pro mesmo page_id (uma delas
-- era dado de teste esquecido). O webhook resolve a conexão com
-- `.maybeSingle()` (lib/social/engine.ts) — com 2 linhas pro mesmo page_id,
-- isso falha silenciosamente e a mensagem nunca é processada.
--
-- Um mesmo page_id (conta profissional do Instagram) só pode pertencer a
-- UMA organização por vez — trava isso no banco pra falhar alto (erro
-- visível na hora de conectar) em vez de quebrar o webhook depois, em
-- silêncio, pra outra org.
ALTER TABLE social_connections
  ADD CONSTRAINT social_connections_platform_page_id_key UNIQUE (platform, page_id);
