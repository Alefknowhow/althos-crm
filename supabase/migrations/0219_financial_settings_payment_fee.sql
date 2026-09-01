-- Taxa cobrada por forma de pagamento (ex.: cartão de crédito ~3,5%,
-- boleto ~2%) — só faz sentido pra type='forma_pagamento'. Percentual com
-- 3 casas decimais (ex.: 3.450 = 3,45%).
alter table financial_settings
  add column if not exists payment_fee_percent numeric(6,3)
    check (payment_fee_percent is null or (payment_fee_percent >= 0 and payment_fee_percent <= 100));
