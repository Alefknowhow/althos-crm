-- Vertical Clínicas — Fase 8: Comissões. Integrado ao Financeiro Core no
-- sentido de nunca duplicar o dado de receita — cada comissão referencia
-- a origem (orçamento aprovado / atendimento realizado / pacote vendido)
-- e calcula a partir do commission_pct já cadastrado em
-- clinic_professionals. Não é um sistema financeiro paralelo: é um
-- registro de cálculo, sem mover dinheiro nem gerar pagamento sozinho.

-- Pacotes podem ter um profissional responsável pela venda (opcional —
-- coluna nova, não existia na Fase 6 porque comissão não fazia parte do
-- escopo ainda).
ALTER TABLE clinic_packages ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS clinic_commissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    professional_id   UUID NOT NULL REFERENCES clinic_professionals(id) ON DELETE CASCADE,
    patient_contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
    -- Origem do cálculo — nunca um valor solto sem rastreabilidade,
    -- exceto 'manual' (ajuste avulso lançado pelo operador).
    source_type       TEXT NOT NULL CHECK (source_type IN ('orcamento', 'atendimento', 'pacote', 'manual')),
    source_id         UUID,
    base_amount_cents INTEGER NOT NULL CHECK (base_amount_cents >= 0),
    commission_pct    NUMERIC(5,2) NOT NULL,
    commission_cents  INTEGER NOT NULL CHECK (commission_cents >= 0),
    status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
    competencia       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes             TEXT,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_commissions_org ON clinic_commissions (organization_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_commissions_professional ON clinic_commissions (professional_id);
-- Evita gerar a mesma comissão automática duas vezes pra mesma origem
-- (ex.: reabrir/fechar um orçamento aprovado de novo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_commissions_source ON clinic_commissions (source_type, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE clinic_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic commissions access" ON clinic_commissions;
CREATE POLICY "Clinic commissions access" ON clinic_commissions
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic commissions super admin" ON clinic_commissions;
CREATE POLICY "Clinic commissions super admin" ON clinic_commissions
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_commissions IS
  'Cálculo de comissão por profissional, rastreado até a origem (orçamento/atendimento/pacote) — não move dinheiro, só registra o cálculo.';
