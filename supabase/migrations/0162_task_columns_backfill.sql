-- Backfill de versionamento — task_columns já existe em produção (usada
-- por actions/tasks.ts e TasksBoard.tsx desde antes desta migration),
-- mas nunca tinha um arquivo correspondente aqui (schema drift achado
-- numa auditoria pré-refactor de Tasks). Todo IF NOT EXISTS: é um
-- no-op em produção, só fecha a lacuna de versionamento.
CREATE TABLE IF NOT EXISTS public.task_columns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL DEFAULT 'A Fazer',
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_columns_org ON public.task_columns (organization_id, position);

ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task columns access" ON public.task_columns;
CREATE POLICY "Task columns access" ON public.task_columns
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Task columns super admin" ON public.task_columns;
CREATE POLICY "Task columns super admin" ON public.task_columns
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE public.task_columns IS 'Colunas do Kanban de Tasks, por organização — backfill de versionamento (tabela já existia em produção sem migration correspondente).';
