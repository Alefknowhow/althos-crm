-- Cotações — Voos: campos que faltavam pra representar um trecho aéreo
-- completo (hora de partida, data/hora de chegada, código do voo).
-- `date` (já existente) continua sendo a data de partida — não renomeado,
-- pra não quebrar nenhuma leitura existente; só a UI passa a rotulá-lo
-- "Data de partida".

ALTER TABLE quotation_flights ADD COLUMN IF NOT EXISTS departure_time TEXT;
ALTER TABLE quotation_flights ADD COLUMN IF NOT EXISTS arrival_date DATE;
ALTER TABLE quotation_flights ADD COLUMN IF NOT EXISTS arrival_time TEXT;
-- Suporta mais de um código quando o trecho representa uma conexão
-- (ex.: "LA3380; LA3385") — texto livre, não um array, pra manter a
-- digitação simples no editor.
ALTER TABLE quotation_flights ADD COLUMN IF NOT EXISTS flight_number TEXT;

COMMENT ON COLUMN quotation_flights.departure_time IS 'Horário de partida (HH:mm), texto livre.';
COMMENT ON COLUMN quotation_flights.arrival_date IS 'Data de chegada — pode diferir de "date" (partida) em voos noturnos/longos.';
COMMENT ON COLUMN quotation_flights.arrival_time IS 'Horário de chegada (HH:mm), texto livre.';
COMMENT ON COLUMN quotation_flights.flight_number IS 'Código(s) do voo — separados por "; " quando o trecho cobre uma conexão (ex.: "LA3380; LA3385").';
