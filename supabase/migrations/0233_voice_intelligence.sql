-- Althos Voice — Fase 5: transcrição, resumo e insights por IA.
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_call_id    uuid NOT NULL UNIQUE REFERENCES voice_calls(id) ON DELETE CASCADE,
  full_text        text,
  -- Segmentado por interlocutor quando disponível: [{speaker, start_s, end_s, text}].
  -- Vazio ([]) quando só temos a transcrição bruta (sem diarização).
  segments         jsonb NOT NULL DEFAULT '[]',
  provider         text NOT NULL DEFAULT 'twilio',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_org ON voice_transcripts(organization_id);

ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice transcripts access" ON voice_transcripts;
CREATE POLICY "Voice transcripts access" ON voice_transcripts FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice transcripts super admin" ON voice_transcripts;
CREATE POLICY "Voice transcripts super admin" ON voice_transcripts FOR ALL USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS voice_call_insights (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_call_id      uuid NOT NULL UNIQUE REFERENCES voice_calls(id) ON DELETE CASCADE,
  summary            text,
  intent             text,
  sentiment          text,               -- positivo | neutro | negativo
  interest_level     text,               -- alto | medio | baixo
  objections         jsonb DEFAULT '[]',
  competitors        jsonb DEFAULT '[]',
  values_mentioned   jsonb DEFAULT '[]',
  dates_mentioned    jsonb DEFAULT '[]',
  products_mentioned jsonb DEFAULT '[]',
  commitments        jsonb DEFAULT '[]',
  suggested_tasks    jsonb DEFAULT '[]',
  next_steps         text,
  outcome            text,
  call_score         integer,
  call_score_breakdown jsonb DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_call_insights_org ON voice_call_insights(organization_id);

ALTER TABLE voice_call_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice call insights access" ON voice_call_insights;
CREATE POLICY "Voice call insights access" ON voice_call_insights FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice call insights super admin" ON voice_call_insights;
CREATE POLICY "Voice call insights super admin" ON voice_call_insights FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_call_insights IS 'Althos Voice: resumo/insights gerados por IA a partir da transcrição — usado como coaching, nunca como julgamento automático de funcionário.';
