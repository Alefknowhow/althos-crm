-- Guardrails de escrita em Ads por org (issue #22, passo 3.4) — checados
-- ANTES de qualquer tool de mutação (pauseCampaign/updateBudget, 3.8)
-- enfileirar uma aprovação. Nenhuma tool de mutação existe ainda (escrita
-- Meta segue atrás de META_ADS_WRITE_ENABLED, não setada em produção) —
-- esta tabela só prepara o terreno, sem uso real até a 3.8.
CREATE TABLE IF NOT EXISTS ads_policies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  max_budget_change_pct    integer NOT NULL DEFAULT 30,
  allow_pause              boolean NOT NULL DEFAULT true,
  allow_budget_change      boolean NOT NULL DEFAULT false,
  autonomy_level           text NOT NULL DEFAULT 'draft' CHECK (autonomy_level IN ('read', 'draft', 'low_risk', 'full_approval')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE ads_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ads policies access" ON ads_policies FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Ads policies super admin" ON ads_policies FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE ads_policies IS 'Issue #22 (3.4): guardrails de autonomia pra mutation tools de Ads (pausar/mudar orçamento) — checadas antes de enfileirar aprovação. Sem uso real até a 3.8 (escrita Meta ainda bloqueada por falta de ads_management/App Review).';
