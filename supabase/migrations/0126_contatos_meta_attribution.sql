-- Guarda os identificadores de clique da Meta (fbc/fbp de formulários,
-- ctwa_clid de conversas de WhatsApp iniciadas por anúncio) no lead, pra
-- que o evento CAPI de Purchase/NotQualified (actions/contatos.ts,
-- moveLeadToStage) consiga ser atribuído de volta ao anúncio/campanha de
-- origem em vez de chegar na Meta sem contexto de atribuição.
ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS meta_fbc TEXT,
  ADD COLUMN IF NOT EXISTS meta_fbp TEXT,
  ADD COLUMN IF NOT EXISTS meta_ctwa_clid TEXT;
