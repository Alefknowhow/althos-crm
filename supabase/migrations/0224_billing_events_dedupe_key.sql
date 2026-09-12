-- Idempotência do webhook Asaas: reentregas (retry por timeout/non-2xx do
-- lado da Asaas) reprocessavam o mesmo evento e creditavam pacotes avulsos
-- de IA em dobro, ou reativavam a mesma assinatura sem nenhum problema mas
-- de forma redundante. dedupe_key = event_type + payment/subscription id do
-- payload — se o mesmo evento chegar de novo, o insert bate em conflito de
-- unique index e o handler não reaplica o efeito colateral.

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_dedupe_key
  ON billing_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN billing_events.dedupe_key IS
  'Chave de idempotência do evento Asaas (event_type + payment/subscription id). Reentregas do provedor batem em conflito de unique index e são ignoradas antes de aplicar qualquer efeito colateral financeiro (créditos avulsos, ativação de plano).';
