-- Terceira forma de pagamento de operadora: "semanal" — corte a cada 8 dias
-- (1-8, 9-16, 17-24, 25-fim do mês — 4 cortes por mês), vencimento fixo em
-- 7 dias após a data de corte. Sem campos extras (nem payment_day nem
-- payment_offset_days) — a regra é fixa, diferente do 'decendio' que tem
-- offset configurável.
alter table financial_settings
  drop constraint if exists financial_settings_payment_schedule_type_check,
  add constraint financial_settings_payment_schedule_type_check
    check (payment_schedule_type in ('dia_fixo', 'decendio', 'semanal'));
