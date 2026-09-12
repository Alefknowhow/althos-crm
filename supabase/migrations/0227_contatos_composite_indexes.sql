-- Índices compostos suspeitos-faltando apontados na auditoria de performance
-- (item 6): quase toda query real de dashboard/funil filtra
-- organization_id + pipeline_id juntos, e o cron de reatribuição (a cada
-- 5min) filtra organization_id + pipeline_id + stage_id + status juntos —
-- os índices existentes em pipeline_id/stage_id eram mono-coluna.

CREATE INDEX IF NOT EXISTS idx_contatos_org_pipeline
  ON contatos (organization_id, pipeline_id);

CREATE INDEX IF NOT EXISTS idx_contatos_org_pipeline_stage_status
  ON contatos (organization_id, pipeline_id, stage_id, status);
