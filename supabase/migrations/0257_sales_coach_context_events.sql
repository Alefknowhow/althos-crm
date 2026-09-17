-- IA Sales Coach — fatia 2/4 (persistência do Sales Context Engine e do
-- Sales Event Engine, ver lib/sales-coach/types.ts e
-- .harness/tasks/active/ia-sales-coach.md). Schema restante (call_summaries,
-- sales_coach_insights, sales_playbooks, objection_library,
-- customer_memories) fica pra fatia 6.

CREATE TABLE IF NOT EXISTS sales_coach_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES sales_coach_sessions(id) ON DELETE CASCADE,
  -- Espelha lib/sales-coach/types.ts::SalesContext — 1 linha por sessão,
  -- atualizada in-place a cada chamada de updateSalesContext().
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coach_context_org ON sales_coach_context(organization_id);

ALTER TABLE sales_coach_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales coach context access" ON sales_coach_context;
CREATE POLICY "Sales coach context access" ON sales_coach_context FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Sales coach context super admin" ON sales_coach_context;
CREATE POLICY "Sales coach context super admin" ON sales_coach_context FOR ALL
  USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS sales_coach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sales_coach_sessions(id) ON DELETE CASCADE,
  -- Um dos 16 tipos de lib/sales-coach/types.ts::SalesEventType — sem CHECK
  -- constraint (mesmo padrão de ai_credit_transactions.module) pra não
  -- exigir migration toda vez que um tipo novo for adicionado no TS.
  type text NOT NULL,
  summary text NOT NULL,
  confidence numeric(3, 2),
  importance numeric(3, 2),
  suggestion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coach_events_org ON sales_coach_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_coach_events_session ON sales_coach_events(session_id, created_at);

ALTER TABLE sales_coach_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales coach events access" ON sales_coach_events;
CREATE POLICY "Sales coach events access" ON sales_coach_events FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Sales coach events super admin" ON sales_coach_events;
CREATE POLICY "Sales coach events super admin" ON sales_coach_events FOR ALL
  USING ((SELECT is_super_admin()));
