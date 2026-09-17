-- IA Sales Coach — fatia 3 (infra de websocket realtime).
-- Tabelas mínimas necessárias para o serviço realtime (Railway) persistir
-- sessões e segmentos de transcrição. Schema completo (eventos, contexto,
-- resumos, coaching, playbooks, objeções, memória) fica para a fatia 2/6 —
-- ver .harness/tasks/active/ia-sales-coach.md.

CREATE TABLE IF NOT EXISTS sales_coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contato_id uuid REFERENCES contatos(id) ON DELETE SET NULL,
  negocio_id uuid REFERENCES negocios(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'ended', 'failed')),
  transcription_provider text NOT NULL DEFAULT 'elevenlabs',
  ai_provider text NOT NULL DEFAULT 'anthropic',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coach_sessions_org ON sales_coach_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_coach_sessions_user ON sales_coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_coach_sessions_status ON sales_coach_sessions(status);

ALTER TABLE sales_coach_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales coach sessions access" ON sales_coach_sessions;
CREATE POLICY "Sales coach sessions access" ON sales_coach_sessions FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Sales coach sessions super admin" ON sales_coach_sessions;
CREATE POLICY "Sales coach sessions super admin" ON sales_coach_sessions FOR ALL
  USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS call_transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sales_coach_sessions(id) ON DELETE CASCADE,
  speaker text,
  text text NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  started_at_ms integer,
  ended_at_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_org ON call_transcript_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_session ON call_transcript_segments(session_id, created_at);

ALTER TABLE call_transcript_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Call transcript segments access" ON call_transcript_segments;
CREATE POLICY "Call transcript segments access" ON call_transcript_segments FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Call transcript segments super admin" ON call_transcript_segments;
CREATE POLICY "Call transcript segments super admin" ON call_transcript_segments FOR ALL
  USING ((SELECT is_super_admin()));

-- committed_transcript (is_final = true) é o que o Sales Context Engine
-- consome; partial_transcript pode ser persistido com is_final = false para
-- replay de UI, mas não deve disparar reprocessamento de contexto.
