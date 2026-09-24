-- Issue #50 (parte da #19) — Biblioteca / Agent Knowledge unificada.
--
-- Decisão de escopo registrada em .harness/tasks/active/orquestrador-global-ia-19.md:
-- camada NOVA e compartilhada, sem migrar as 3 bases isoladas que já
-- existem (ai_knowledge_items — FAQ do atendente WhatsApp;
-- lib/sales-coach/knowledge.ts — MVP sem tabela dedicada ainda;
-- roteirista_knowledge_items — Travel Planner). Migrar dados legados de
-- produção é risco desnecessário pro objetivo real desta issue ("evitar
-- armazenamento paralelo daqui pra frente"); source_module só documenta a
-- origem de cada item pra uma consolidação futura, se um dia fizer sentido.
CREATE TABLE IF NOT EXISTS library_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_module     text NOT NULL DEFAULT 'library',
  category          text,
  title             text NOT NULL,
  content           text NOT NULL,
  priority          integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_items_org ON library_items(organization_id);

ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Library items access" ON library_items;
CREATE POLICY "Library items access" ON library_items FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Library items super admin" ON library_items;
CREATE POLICY "Library items super admin" ON library_items FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE library_items IS 'Issue #50: Biblioteca/Agent Knowledge compartilhada entre agentes de IA da org (Agent Definitions, Orquestrador, etc.) — camada nova, não substitui ai_knowledge_items/roteirista_knowledge_items/sales-coach ainda. Ver lib/ai/library.ts.';
