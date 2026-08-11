-- Algumas operadoras não pagam num dia fixo do mês — pagam por "decêndio"
-- (a cada bloco de 10 dias: 1-10, 11-20, 21-fim do mês), um número fixo de
-- dias depois que o decêndio em que a venda caiu se fecha. payment_day
-- continua valendo pro modo 'dia_fixo' (default, mantém comportamento
-- atual); payment_offset_days só é usado no modo 'decendio'.
alter table financial_settings
  add column if not exists payment_schedule_type text not null default 'dia_fixo'
    check (payment_schedule_type in ('dia_fixo', 'decendio')),
  add column if not exists payment_offset_days smallint check (payment_offset_days between 0 and 60);
