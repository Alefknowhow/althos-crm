-- Módulo Projetos (Agências de Tráfego) — camada de organização sobre o
-- sistema de Tasks já existente. Não duplica Tasks: um projeto agrupa tasks
-- reais via tasks.project_id, e project_groups é só um agrupador leve
-- (etapas tipo "Planejamento"/"Criativos") — não é outro sistema de tarefas.
--
-- CLIENTE (contatos) → PROJETO (projetos) → TASKS (tasks.project_id)
--
-- status é o estado do Kanban (a_fazer/em_andamento/concluido). health é uma
-- propriedade auxiliar independente (normal/atencao/bloqueado/
-- aguardando_cliente/em_risco) — não é coluna do Kanban, ver CLAUDE.md do
-- módulo. project_id/project_group_id em tasks aceitam NULL: tasks
-- existentes continuam funcionando sem qualquer migração manual.

CREATE TABLE IF NOT EXISTS projetos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    objective       TEXT,
    owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer', 'em_andamento', 'concluido')),
    health          TEXT NOT NULL DEFAULT 'normal' CHECK (health IN ('normal', 'atencao', 'bloqueado', 'aguardando_cliente', 'em_risco')),
    start_date      DATE,
    due_date        DATE,
    completed_at    TIMESTAMPTZ,
    archived_at     TIMESTAMPTZ,
    -- Arquitetura preparada para Project Templates (seção 19 do escopo): um
    -- projeto criado a partir de um template guarda a referência, sem exigir
    -- o sistema de templates completo agora.
    template_key    TEXT,
    position        INTEGER NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projetos_org ON projetos (organization_id);
CREATE INDEX IF NOT EXISTS idx_projetos_client ON projetos (organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos (organization_id, status);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projetos access" ON projetos
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Projetos super admin" ON projetos
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS projeto_grupos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projeto_grupos_org ON projeto_grupos (organization_id);
CREATE INDEX IF NOT EXISTS idx_projeto_grupos_project ON projeto_grupos (project_id);

ALTER TABLE projeto_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projeto grupos access" ON projeto_grupos
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Projeto grupos super admin" ON projeto_grupos
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_projetos_updated_at
  BEFORE UPDATE ON projetos
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

CREATE TRIGGER trg_projeto_grupos_updated_at
  BEFORE UPDATE ON projeto_grupos
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

-- Task global ganha vínculo opcional com Projeto/Grupo. Independente dos
-- slots de "Relacionado a" (contato_id/sale_id/related_entity_*) — uma task
-- de projeto continua podendo ter contato_id preenchido (cliente do projeto)
-- ao mesmo tempo, sem entrar na regra de "um slot por vez".
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projetos(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_group_id UUID REFERENCES projeto_grupos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_group ON tasks (project_group_id) WHERE project_group_id IS NOT NULL;

COMMENT ON TABLE projetos IS
  'Módulo Projetos (Agências de Tráfego) — camada de organização sobre Tasks. Cliente (contatos) → Projeto → Tasks (tasks.project_id). Não duplica Tasks/Agenda/responsáveis.';
COMMENT ON TABLE projeto_grupos IS
  'Etapas/agrupadores leves dentro de um projeto (ex.: Planejamento, Criativos) — apenas agrupam tasks.project_group_id, não são outro sistema de tarefas.';
COMMENT ON COLUMN tasks.project_id IS 'Projeto ao qual a task pertence (módulo Projetos, Agências de Tráfego). NULL para tasks fora de um projeto.';
COMMENT ON COLUMN tasks.project_group_id IS 'Grupo/etapa do projeto ao qual a task pertence. Só é significativo quando project_id também está preenchido.';
