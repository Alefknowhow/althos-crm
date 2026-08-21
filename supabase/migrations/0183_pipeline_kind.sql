ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS kind TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_org_kind
  ON pipelines (organization_id, kind)
  WHERE kind IS NOT NULL;

COMMENT ON COLUMN pipelines.kind IS
  'Vertical Imobiliárias (Fase 7) — marca um pipeline "especial" gerenciado por automação (ex.: ''imoveis''), pra código de sistema encontrar o pipeline certo sem depender de nome digitado pelo usuário. NULL = pipeline comum criado manualmente.';
