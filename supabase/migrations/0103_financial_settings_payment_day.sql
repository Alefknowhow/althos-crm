-- Dia do mês em que cada operadora paga a comissão — usado só pelo tipo
-- 'operadora' (as demais listas ignoram esse campo). Com isso a receita da
-- venda pode ser lançada na data real de pagamento em vez do dia da venda.
alter table financial_settings
  add column if not exists payment_day smallint check (payment_day between 1 and 31);
