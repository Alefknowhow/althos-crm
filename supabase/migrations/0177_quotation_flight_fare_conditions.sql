-- Campo novo do editor de cotações: etiquetas de condição de tarifa do
-- aéreo (não reembolsável / permite alteração com custo / não permite
-- alteração) — global por cotação, não por trecho. Ver
-- components/features/quotations/QuotationEditor.tsx (FARE_CONDITIONS) e
-- actions/quotations.ts (QuotationSchema.flight_fare_conditions).
ALTER TABLE public.travel_proposals
  ADD COLUMN IF NOT EXISTS flight_fare_conditions text[] NOT NULL DEFAULT '{}';
