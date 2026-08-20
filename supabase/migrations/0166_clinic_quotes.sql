-- Vertical Clínicas — Fase 4: Orçamentos. Paciente = contatos (Core, sem
-- duplicar), profissional/serviço = clinic_professionals/event_types já
-- existentes. Link público/assinatura ficam de fora desta fatia (o projeto
-- já tem um motor de link público de propostas — avaliar reaproveitar numa
-- fatia futura, em vez de duplicar agora).

CREATE TABLE IF NOT EXISTS clinic_quotes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    professional_id  UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    status           TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho', 'enviado', 'visualizado', 'aprovado', 'recusado', 'expirado', 'cancelado')),
    discount_cents   INTEGER NOT NULL DEFAULT 0,
    valid_until      DATE,
    notes            TEXT,
    created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at          TIMESTAMPTZ,
    viewed_at        TIMESTAMPTZ,
    approved_at      TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_quotes_org ON clinic_quotes (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_clinic_quotes_patient ON clinic_quotes (patient_contato_id);

CREATE TABLE IF NOT EXISTS clinic_quote_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id         UUID NOT NULL REFERENCES clinic_quotes(id) ON DELETE CASCADE,
    event_type_id    UUID REFERENCES event_types(id) ON DELETE SET NULL,
    description      TEXT NOT NULL,
    quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_clinic_quote_items_quote ON clinic_quote_items (quote_id);

ALTER TABLE clinic_quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic quotes access" ON clinic_quotes;
CREATE POLICY "Clinic quotes access" ON clinic_quotes
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic quotes super admin" ON clinic_quotes;
CREATE POLICY "Clinic quotes super admin" ON clinic_quotes
  FOR ALL USING ((SELECT is_super_admin()));

-- clinic_quote_items não tem organization_id direto — a policy passa pelo
-- quote pai, mesmo padrão usado em outros itens-de-linha do projeto
-- (ex.: itens de cotação de viagem).
DROP POLICY IF EXISTS "Clinic quote items access" ON clinic_quote_items;
CREATE POLICY "Clinic quote items access" ON clinic_quote_items
  FOR ALL USING (
    quote_id IN (
      SELECT id FROM clinic_quotes WHERE organization_id IN (SELECT get_user_organizations())
    )
  );
DROP POLICY IF EXISTS "Clinic quote items super admin" ON clinic_quote_items;
CREATE POLICY "Clinic quote items super admin" ON clinic_quote_items
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_quotes IS
  'Orçamentos da vertical Clínicas — paciente é contatos (Core), sem cadastro paralelo.';
