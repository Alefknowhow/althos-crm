-- IA Sales Coach — Knowledge Base + Objection Library por organização
-- (spec §17/§19). MVP: um blob estruturado por org (sem retrieval/
-- embeddings ainda — texto é curto o bastante pra caber direto no prompt
-- das engines; retrieval fica pra quando a Knowledge Base crescer além
-- disso). Ver .harness/tasks/active/ia-sales-coach.md.

CREATE TABLE IF NOT EXISTS sales_coach_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  company_pitch text NOT NULL DEFAULT '',
  products text NOT NULL DEFAULT '',
  differentiators text NOT NULL DEFAULT '',
  competitors text NOT NULL DEFAULT '',
  -- Objection Library (§17): array de {id, name, category, description, recommendedStrategy}.
  objections jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coach_knowledge_org ON sales_coach_knowledge(organization_id);

ALTER TABLE sales_coach_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales coach knowledge access" ON sales_coach_knowledge;
CREATE POLICY "Sales coach knowledge access" ON sales_coach_knowledge FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Sales coach knowledge super admin" ON sales_coach_knowledge;
CREATE POLICY "Sales coach knowledge super admin" ON sales_coach_knowledge FOR ALL
  USING ((SELECT is_super_admin()));
