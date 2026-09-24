-- Issue #17 — Agenda → Projetos: etapas de Kanban configuráveis, tags,
-- timeline e templates.
--
-- `projetos.status` era um enum fixo de 3 valores (a_fazer/em_andamento/
-- concluido) — a issue pede etapas configuráveis por org (ex.: Planejamento →
-- Produção → Revisão → Aguardando cliente → Concluído). `status` é mantida
-- (não apagada, sem perda de histórico) mas deixa de ser a fonte de verdade
-- do Kanban: o board passa a usar `column_id` (FK pra project_columns).
-- `is_done` marca qual(is) coluna(s) fecha(m) o projeto (seta completed_at),
-- sem nenhuma automação de mover/concluir por percentual — só ação manual.

CREATE TABLE IF NOT EXISTS project_columns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    is_done         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_columns_org ON project_columns (organization_id, position);

ALTER TABLE project_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project columns access" ON project_columns
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Project columns super admin" ON project_columns
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_project_columns_updated_at
  BEFORE UPDATE ON project_columns
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES project_columns(id) ON DELETE SET NULL;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_projetos_column ON projetos (column_id) WHERE column_id IS NOT NULL;

-- Backfill: 3 colunas default por org que já tem projeto, mapeando o status
-- atual. Guardado por "só roda se project_columns ainda está vazia" pra ser
-- seguro contra reexecução acidental.
DO $$
DECLARE
  org_row RECORD;
  col_a UUID;
  col_b UUID;
  col_c UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM project_columns LIMIT 1) THEN
    FOR org_row IN SELECT DISTINCT organization_id FROM projetos LOOP
      INSERT INTO project_columns (organization_id, name, position, is_done) VALUES (org_row.organization_id, 'A Fazer', 0, false) RETURNING id INTO col_a;
      INSERT INTO project_columns (organization_id, name, position, is_done) VALUES (org_row.organization_id, 'Em Andamento', 1, false) RETURNING id INTO col_b;
      INSERT INTO project_columns (organization_id, name, position, is_done) VALUES (org_row.organization_id, 'Concluído', 2, true) RETURNING id INTO col_c;

      UPDATE projetos SET column_id = col_a WHERE organization_id = org_row.organization_id AND status = 'a_fazer';
      UPDATE projetos SET column_id = col_b WHERE organization_id = org_row.organization_id AND status = 'em_andamento';
      UPDATE projetos SET column_id = col_c WHERE organization_id = org_row.organization_id AND status = 'concluido';
    END LOOP;
  END IF;
END $$;

-- Timeline de Projeto — não generaliza contato_activities (tem trigger
-- próprio de contatos.last_activity_at); tabela dedicada, mesmo shape.
CREATE TABLE IF NOT EXISTS project_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    payload         JSONB,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activities_org ON project_activities (organization_id);

ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project activities access" ON project_activities
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Project activities super admin" ON project_activities
  FOR ALL USING ((SELECT is_super_admin()));

-- Templates de Projeto — aplicar um template cria 1 Projeto + N Tasks
-- globais reais (tasks.project_id), com prazos relativos a uma data de
-- referência escolhida na hora de aplicar. `steps` é a lista ordenada:
-- [{ title, description?, offset_days, priority?, group? }].
CREATE TABLE IF NOT EXISTS project_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    steps           JSONB NOT NULL DEFAULT '[]',
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_templates_org ON project_templates (organization_id);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project templates access" ON project_templates
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Project templates super admin" ON project_templates
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_project_templates_updated_at
  BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

COMMENT ON TABLE project_columns IS 'Etapas configuráveis do Kanban geral de Agenda → Projetos (issue #17). is_done marca a(s) coluna(s) que fecham o projeto (completed_at), setado só manualmente.';
COMMENT ON TABLE project_activities IS 'Timeline de Agenda → Projetos — eventos relevantes (criação, mudança de etapa, tasks, template aplicado). Não inclui mutations feitas pela tool genérica de IA (essas ficam em agent_audit_log).';
COMMENT ON TABLE project_templates IS 'Templates de Projeto — aplicar um cria 1 projeto + N tasks reais (tasks.project_id) com prazos relativos (steps[].offset_days a partir da data de referência escolhida ao aplicar).';
COMMENT ON COLUMN projetos.column_id IS 'Etapa atual no Kanban configurável (project_columns). status é mantida só como histórico/legado, não é mais a fonte de verdade.';
COMMENT ON COLUMN projetos.tags IS 'Tags livres do projeto (issue #17) — busca/filtro simples, sem cadastro de tags dedicado.';
