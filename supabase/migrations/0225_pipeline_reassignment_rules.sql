-- Reatribuição por timeout deixa de ser "1 config fixa no primeiro estágio,
-- ligada junto com o toggle geral de distribuição" e vira uma feature
-- separada, com toggle próprio (default OFF, conforme pedido explícito) e
-- N regras configuráveis (estágio + minutos sem resposta), não só o 1º
-- estágio do pipeline.
--
-- pipeline_distribution_settings.enabled continua controlando só a FILA de
-- distribuição (quem recebe leads novos que entram automaticamente).
-- reassignment_enabled é um toggle independente: dá pra ter fila ligada sem
-- reatribuição automática, e vice-versa.
--
-- first_stage_timeout_minutes fica como coluna legada (não lida mais pelo
-- cron) — não removida agora pra não quebrar nada que ainda a leia por
-- engano; o valor real agora mora em pipeline_reassignment_rules.

ALTER TABLE pipeline_distribution_settings
  ADD COLUMN IF NOT EXISTS reassignment_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS pipeline_reassignment_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id      UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id         UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  timeout_minutes  INTEGER NOT NULL CHECK (timeout_minutes > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_reassignment_rules_org
  ON pipeline_reassignment_rules (organization_id, pipeline_id);

ALTER TABLE pipeline_reassignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pipeline reassignment rules access" ON pipeline_reassignment_rules
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON pipeline_reassignment_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migra config existente (1ª etapa + first_stage_timeout_minutes) pra uma
-- regra explícita, MAS reassignment_enabled fica false pra TODO MUNDO —
-- pedido explícito do produto é que essa feature nasça desligada por
-- padrão, mesmo pra quem já tinha configurado antes (reabrir é 1 clique).
INSERT INTO pipeline_reassignment_rules (organization_id, pipeline_id, stage_id, timeout_minutes)
SELECT
  s.organization_id,
  s.pipeline_id,
  (SELECT ps.id FROM pipeline_stages ps WHERE ps.pipeline_id = s.pipeline_id ORDER BY ps.position ASC LIMIT 1),
  s.first_stage_timeout_minutes
FROM pipeline_distribution_settings s
WHERE s.first_stage_timeout_minutes IS NOT NULL
  AND s.first_stage_timeout_minutes > 0
  AND EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.pipeline_id = s.pipeline_id)
ON CONFLICT (pipeline_id, stage_id) DO NOTHING;

COMMENT ON COLUMN pipeline_distribution_settings.reassignment_enabled IS
  'Toggle independente da fila de distribuição (settings.enabled) — reatribuição automática por falta de resposta. Default false: nasce desligada mesmo para pipelines que já tinham first_stage_timeout_minutes configurado.';
COMMENT ON TABLE pipeline_reassignment_rules IS
  'Regras de reatribuição por timeout: 1 por (pipeline_id, stage_id). Substitui pipeline_distribution_settings.first_stage_timeout_minutes (legado, mantido só por compatibilidade histórica).';
