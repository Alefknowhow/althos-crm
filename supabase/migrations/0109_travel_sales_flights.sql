-- Segmentos de voo estruturados (ida/volta, cada trecho com companhia,
-- número, data, origem/destino e horário) para poder emitir um voucher
-- padrão de operadora com todos os trechos, em vez de só um voo/data única.
-- Os campos escalares existentes (airline, departure_date, return_date,
-- air_locator) continuam servindo de fallback/resumo.

ALTER TABLE travel_sales
  ADD COLUMN IF NOT EXISTS flights jsonb NOT NULL DEFAULT '[]'::jsonb;
