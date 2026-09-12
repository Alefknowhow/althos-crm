-- Pixel/CAPI da Meta vira configuração por pipeline (não mais por conta) —
-- ver components/features/PipelineConfigDialog.tsx. As colunas antigas em
-- organizations não são removidas (sem uso, sem risco de perda de dado).
alter table pipelines
  add column if not exists meta_pixel_id text,
  add column if not exists meta_access_token text;

-- Preserva o comportamento atual pra quem já tinha configurado: copia
-- pro pipeline padrão de cada org (não pros demais, por decisão do usuário).
update pipelines p
set meta_pixel_id = o.meta_pixel_id, meta_access_token = o.meta_access_token
from organizations o
where p.organization_id = o.id
  and p.is_default = true
  and o.meta_pixel_id is not null;
