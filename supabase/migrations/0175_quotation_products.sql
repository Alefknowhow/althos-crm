-- Cotações — Construtor de Viagens modular (Fase 1).
--
-- Unifica Aéreo/Hospedagem e todo produto futuro (Cruzeiro, Transfer,
-- Passeio, Seguro, Locação) numa única tabela genérica, em vez de uma
-- tabela dedicada por tipo. Campos comuns ficam em colunas (usados pro
-- card resumido, ordenação, cálculo de investimento); campos específicos
-- de cada tipo ficam em `data` (jsonb) — assim um tipo novo nunca exige
-- migração de schema, só um novo editor de UI. `internal_data` guarda
-- informação comercial interna (comissão, markup, fornecedor, custo,
-- margem, código de tarifa) — nunca lida pela RPC pública nem pelo PDF.
--
-- quotation_lodgings/quotation_flights permanecem no banco (histórico,
-- não usadas mais pela aplicação a partir desta migração) — dado
-- migrado, não apagado. Podem ser removidas numa limpeza futura depois
-- de confirmado que tudo funciona.

CREATE TABLE IF NOT EXISTS quotation_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    UUID NOT NULL REFERENCES travel_proposals(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_type    TEXT NOT NULL CHECK (product_type IN ('aereo', 'hospedagem', 'cruzeiro', 'transfer', 'passeio', 'seguro', 'locacao')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    -- Campos comuns — alimentam o card resumido e o cálculo central de
    -- investimento sem precisar interpretar `data` (que varia por tipo).
    name            TEXT,
    summary         TEXT,
    date_start      DATE,
    date_end        DATE,
    price_cents     INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    internal_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotation_products_quotation ON quotation_products (quotation_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_quotation_products_org ON quotation_products (organization_id);

ALTER TABLE quotation_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quotation products access" ON quotation_products;
CREATE POLICY "Quotation products access" ON quotation_products
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Quotation products super admin" ON quotation_products;
CREATE POLICY "Quotation products super admin" ON quotation_products
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE quotation_products IS
  'Produtos de uma cotação de viagem (Aéreo/Hospedagem/Cruzeiro/Transfer/Passeio/Seguro/Locação) — infraestrutura única de add/editar/ordenar/excluir/duplicar, campos específicos em data (jsonb).';
COMMENT ON COLUMN quotation_products.internal_data IS
  'Dado comercial interno (comissão, markup, fornecedor, custo, margem, código de tarifa) — nunca exposto na proposta pública nem no PDF.';

-- ── Backfill: quotation_lodgings → quotation_products (tipo hospedagem) ──
INSERT INTO quotation_products (quotation_id, organization_id, product_type, sort_order, name, date_start, date_end, price_cents, data, created_at)
SELECT
  l.quotation_id, tp.organization_id, 'hospedagem', l.sort_order,
  NULLIF(l.name, ''), l.check_in, l.check_out, l.option_total_cents,
  jsonb_build_object(
    'check_in', l.check_in, 'check_out', l.check_out, 'room_category', l.room_category, 'board', l.board,
    'description_html', l.description_html, 'photos', COALESCE(l.photos, '[]'::jsonb),
    'lat', l.lat, 'lng', l.lng,
    'tripadvisor_location_id', l.tripadvisor_location_id, 'tripadvisor_data', l.tripadvisor_data,
    'is_alternative_option', COALESCE(l.is_alternative_option, false),
    'option_price_per_person_cents', l.option_price_per_person_cents,
    'option_total_cents', l.option_total_cents
  ),
  COALESCE(l.created_at, NOW())
FROM quotation_lodgings l
JOIN travel_proposals tp ON tp.id = l.quotation_id
WHERE NOT EXISTS (
  SELECT 1 FROM quotation_products qp WHERE qp.quotation_id = l.quotation_id AND qp.product_type = 'hospedagem'
);

-- ── Backfill: quotation_flights → quotation_products (tipo aereo) ──
INSERT INTO quotation_products (quotation_id, organization_id, product_type, sort_order, name, date_start, date_end, data, created_at)
SELECT
  f.quotation_id, tp.organization_id, 'aereo', f.sort_order,
  NULLIF(TRIM(BOTH ' → ' FROM CONCAT_WS(' → ', NULLIF(COALESCE(f.from_city, f.from_code), ''), NULLIF(COALESCE(f.to_city, f.to_code), ''))), ''),
  f.date, COALESCE(f.arrival_date, f.date),
  jsonb_build_object(
    'leg_type', f.leg_type, 'from_code', f.from_code, 'from_city', f.from_city, 'to_code', f.to_code, 'to_city', f.to_city,
    'airline', f.airline, 'flight_number', f.flight_number, 'date', f.date, 'departure_time', f.departure_time,
    'arrival_date', f.arrival_date, 'arrival_time', f.arrival_time, 'duration_label', f.duration_label,
    'stopover_label', f.stopover_label, 'baggage', COALESCE(f.baggage, '[]'::jsonb), 'cabin_class', f.cabin_class
  ),
  COALESCE(f.created_at, NOW())
FROM quotation_flights f
JOIN travel_proposals tp ON tp.id = f.quotation_id
WHERE NOT EXISTS (
  SELECT 1 FROM quotation_products qp WHERE qp.quotation_id = f.quotation_id AND qp.product_type = 'aereo'
);
