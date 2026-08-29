-- Forma de pagamento do cliente na venda (Pix/Boleto/Cartão/Dinheiro/Outro) —
-- não existia antes; usado no Rank de recompra (aba Clientes) e no editor
-- de Reservas. Texto livre com sugestões fixas na UI (como forma_pagamento
-- de financial_entries), sem CHECK pra não travar em valores futuros.
ALTER TABLE travel_sales
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

COMMENT ON COLUMN travel_sales.payment_method IS
  'Forma de pagamento do cliente (Pix/Boleto/Cartão/Dinheiro/Outro) — texto livre, sugestões fixas na UI.';
