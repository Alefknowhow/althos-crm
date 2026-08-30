-- Vertical Clínicas — Estoque de insumos. Exclusivo do nicho (sem
-- equivalente genérico no CRM Core). Baixa automática por consumo em
-- atendimento (via receita por procedimento) + entrada por NF importada.

-- ── Catálogo de insumos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_supplies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    unit                  TEXT NOT NULL DEFAULT 'un', -- un, ml, cx, g, etc. — texto livre curto
    supplier_name         TEXT,
    quantity_in_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_stock_alert       NUMERIC(12,3),
    last_unit_cost_cents  INTEGER,
    first_acquired_at     TIMESTAMPTZ,
    last_purchase_at      TIMESTAMPTZ,
    last_purchase_nf_number TEXT,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_supplies_org ON clinic_supplies (organization_id);
CREATE INDEX IF NOT EXISTS idx_clinic_supplies_name ON clinic_supplies (organization_id, name);

-- ── Receita por procedimento (quanto de cada insumo um procedimento gasta) ──
CREATE TABLE IF NOT EXISTS clinic_supply_recipe (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type_id   UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    supply_id       UUID NOT NULL REFERENCES clinic_supplies(id) ON DELETE CASCADE,
    quantity_per_use NUMERIC(12,3) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_type_id, supply_id)
);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_recipe_org ON clinic_supply_recipe (organization_id);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_recipe_event_type ON clinic_supply_recipe (event_type_id);

-- ── Backlog de consumo (baixa) — rastreável por atendimento/profissional ────
CREATE TABLE IF NOT EXISTS clinic_supply_consumption_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supply_id         UUID NOT NULL REFERENCES clinic_supplies(id) ON DELETE CASCADE,
    quantity          NUMERIC(12,3) NOT NULL,
    source            TEXT NOT NULL DEFAULT 'atendimento' CHECK (source IN ('atendimento', 'manual', 'ajuste')),
    attendance_id     UUID REFERENCES clinic_attendances(id) ON DELETE SET NULL,
    professional_id   UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    patient_contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
    notes             TEXT,
    consumed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_consumption_org ON clinic_supply_consumption_log (organization_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_consumption_supply ON clinic_supply_consumption_log (supply_id);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_consumption_attendance ON clinic_supply_consumption_log (attendance_id);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_consumption_professional ON clinic_supply_consumption_log (professional_id);

-- ── Notas fiscais de entrada ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_supply_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nf_number       TEXT,
    supplier_name   TEXT,
    issued_at       DATE,
    total_cents     INTEGER,
    import_method   TEXT NOT NULL DEFAULT 'manual' CHECK (import_method IN ('xml', 'ocr', 'manual')),
    storage_path    TEXT, -- caminho no bucket, quando um arquivo foi enviado (XML/PDF)
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_invoices_org ON clinic_supply_invoices (organization_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS clinic_supply_invoice_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id        UUID NOT NULL REFERENCES clinic_supply_invoices(id) ON DELETE CASCADE,
    supply_id         UUID REFERENCES clinic_supplies(id) ON DELETE SET NULL, -- null até o item ser mapeado/confirmado
    description_raw   TEXT NOT NULL,
    quantity          NUMERIC(12,3) NOT NULL,
    unit_cost_cents   INTEGER,
    total_cost_cents  INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_invoice_items_invoice ON clinic_supply_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_clinic_supply_invoice_items_org ON clinic_supply_invoice_items (organization_id);

-- ── RLS — mesmo padrão do resto do projeto ──────────────────────────────────
ALTER TABLE clinic_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_supply_recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_supply_consumption_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_supply_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_supply_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic supplies access" ON clinic_supplies;
CREATE POLICY "Clinic supplies access" ON clinic_supplies FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic supplies super admin" ON clinic_supplies;
CREATE POLICY "Clinic supplies super admin" ON clinic_supplies FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic supply recipe access" ON clinic_supply_recipe;
CREATE POLICY "Clinic supply recipe access" ON clinic_supply_recipe FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic supply recipe super admin" ON clinic_supply_recipe;
CREATE POLICY "Clinic supply recipe super admin" ON clinic_supply_recipe FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic supply consumption access" ON clinic_supply_consumption_log;
CREATE POLICY "Clinic supply consumption access" ON clinic_supply_consumption_log FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic supply consumption super admin" ON clinic_supply_consumption_log;
CREATE POLICY "Clinic supply consumption super admin" ON clinic_supply_consumption_log FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic supply invoices access" ON clinic_supply_invoices;
CREATE POLICY "Clinic supply invoices access" ON clinic_supply_invoices FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic supply invoices super admin" ON clinic_supply_invoices;
CREATE POLICY "Clinic supply invoices super admin" ON clinic_supply_invoices FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic supply invoice items access" ON clinic_supply_invoice_items;
CREATE POLICY "Clinic supply invoice items access" ON clinic_supply_invoice_items FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic supply invoice items super admin" ON clinic_supply_invoice_items;
CREATE POLICY "Clinic supply invoice items super admin" ON clinic_supply_invoice_items FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_supplies IS 'Catálogo de insumos (estoque) — nicho Clínicas.';
COMMENT ON TABLE clinic_supply_recipe IS 'Quanto de cada insumo um procedimento (event_type) consome por uso — baixa automática ao finalizar atendimento.';
COMMENT ON TABLE clinic_supply_consumption_log IS 'Backlog de baixa de estoque — rastreável por atendimento/profissional/paciente.';
COMMENT ON TABLE clinic_supply_invoices IS 'Notas fiscais de entrada de insumos — importadas via XML/OCR ou lançadas manualmente.';
COMMENT ON TABLE clinic_supply_invoice_items IS 'Itens de uma NF — supply_id fica null até o item ser mapeado a um insumo do catálogo.';
