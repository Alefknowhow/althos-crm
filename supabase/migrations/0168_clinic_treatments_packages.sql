-- Vertical Clínicas — Fase 6: Tratamentos (planos de múltiplas sessões) e
-- Pacotes (lotes de sessões pré-pagos). Paciente = contatos (Core), sem
-- duplicação. Pacotes com valor geram um lançamento em financial_entries
-- (Core) — nunca um sistema financeiro paralelo.

CREATE TABLE IF NOT EXISTS clinic_treatments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    professional_id   UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    event_type_id     UUID REFERENCES event_types(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,
    total_sessions    INTEGER NOT NULL CHECK (total_sessions > 0),
    sessions_done     INTEGER NOT NULL DEFAULT 0 CHECK (sessions_done >= 0),
    status            TEXT NOT NULL DEFAULT 'planejado'
        CHECK (status IN ('planejado', 'em_andamento', 'concluido', 'pausado', 'cancelado')),
    notes             TEXT,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_treatments_org ON clinic_treatments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_treatments_patient ON clinic_treatments (patient_contato_id);

CREATE TABLE IF NOT EXISTS clinic_packages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    total_sessions    INTEGER NOT NULL CHECK (total_sessions > 0),
    sessions_used     INTEGER NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
    value_cents       INTEGER,
    valid_until       DATE,
    status            TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'utilizado', 'expirado', 'cancelado')),
    -- Lançamento financeiro (Core) gerado na criação, quando value_cents >
    -- 0 — nunca um sistema financeiro paralelo pra vertical.
    financial_entry_id UUID REFERENCES financial_entries(id) ON DELETE SET NULL,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_packages_org ON clinic_packages (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_packages_patient ON clinic_packages (patient_contato_id);

-- Permite marcar, num registro de atendimento, que a sessão pertence a um
-- tratamento ou consome uma sessão de um pacote (opcional, nulo na maioria
-- dos atendimentos avulsos).
ALTER TABLE clinic_attendances ADD COLUMN IF NOT EXISTS treatment_id UUID REFERENCES clinic_treatments(id) ON DELETE SET NULL;
ALTER TABLE clinic_attendances ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES clinic_packages(id) ON DELETE SET NULL;

ALTER TABLE clinic_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic treatments access" ON clinic_treatments;
CREATE POLICY "Clinic treatments access" ON clinic_treatments
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic treatments super admin" ON clinic_treatments;
CREATE POLICY "Clinic treatments super admin" ON clinic_treatments
  FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic packages access" ON clinic_packages;
CREATE POLICY "Clinic packages access" ON clinic_packages
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic packages super admin" ON clinic_packages;
CREATE POLICY "Clinic packages super admin" ON clinic_packages
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_treatments IS 'Plano de tratamento com N sessões — progresso via sessions_done/total_sessions.';
COMMENT ON TABLE clinic_packages IS 'Pacote de sessões pré-pago — integrado a financial_entries (Core), sem financeiro paralelo.';
