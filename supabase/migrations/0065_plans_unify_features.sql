-- ============================================================================
-- 0065_plans_unify_features.sql
-- Unifica as funcionalidades dos planos pagos (junho/2026).
--
--   * Starter/Pro/Business passam a oferecer as MESMAS funcionalidades — a
--     diferença vira QUANTIDADE de uso (usuários, orgs, pipelines, clientes,
--     créditos de IA, automações, social…).
--   * Exceções premium (Pro/Business apenas): ai_insights + export_reports.
--   * white_label REMOVIDO da oferta (false em todos os planos).
--   * multi_tenant acompanha a quantidade de orgs: Starter 1 (false),
--     Pro 5 (true), Business ilimitado (true).
--   * Novos limites: max_organizations (orgs por conta) e max_forms
--     (formulários de captação). Free = 1 org, 1 formulário.
-- Convenção: -1 = ilimitado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Novos limites estruturados.
-- ----------------------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_organizations integer NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_forms         integer NOT NULL DEFAULT 1;

UPDATE plans SET max_organizations = 1,  max_forms = 1  WHERE id = 'free';
UPDATE plans SET max_organizations = 1,  max_forms = -1 WHERE id = 'starter';
UPDATE plans SET max_organizations = 5,  max_forms = -1 WHERE id = 'pro';
UPDATE plans SET max_organizations = -1, max_forms = -1 WHERE id = 'business';

-- ----------------------------------------------------------------------------
-- 2) Funcionalidades unificadas (features jsonb).
-- ----------------------------------------------------------------------------
UPDATE plans SET features = '{
  "tasks": false, "catalogo": false, "whatsapp": false, "capi_pixel": false,
  "ai_insights": false, "white_label": false, "agendamentos": false,
  "ai_attendant": false, "lead_scoring": false, "multi_tenant": false,
  "export_reports": false, "meta_ads_panel": false, "instagram_automation": false
}'::jsonb
WHERE id = 'free';

UPDATE plans SET features = '{
  "tasks": true, "catalogo": true, "whatsapp": true, "capi_pixel": true,
  "ai_insights": false, "white_label": false, "agendamentos": true,
  "ai_attendant": true, "lead_scoring": true, "multi_tenant": false,
  "export_reports": false, "meta_ads_panel": true, "instagram_automation": true
}'::jsonb
WHERE id = 'starter';

UPDATE plans SET features = '{
  "tasks": true, "catalogo": true, "whatsapp": true, "capi_pixel": true,
  "ai_insights": true, "white_label": false, "agendamentos": true,
  "ai_attendant": true, "lead_scoring": true, "multi_tenant": true,
  "export_reports": true, "meta_ads_panel": true, "instagram_automation": true
}'::jsonb
WHERE id = 'pro';

UPDATE plans SET features = '{
  "tasks": true, "catalogo": true, "whatsapp": true, "capi_pixel": true,
  "ai_insights": true, "white_label": false, "agendamentos": true,
  "ai_attendant": true, "lead_scoring": true, "multi_tenant": true,
  "export_reports": true, "meta_ads_panel": true, "instagram_automation": true
}'::jsonb
WHERE id = 'business';
