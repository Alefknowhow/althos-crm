-- AI qualifier (Bloco 2 do roadmap).
-- Per-org config and per-lead qualification fields.
-- Idempotent — safe to re-run.

-- 1) Org-level AI configuration.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'anthropic',
  -- API key stored as plaintext for now; swap to Supabase Vault before prod.
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_qualifier_model TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  ADD COLUMN IF NOT EXISTS ai_qualifier_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_business_context TEXT;

-- 2) Per-lead qualification fields.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS ai_score INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ADD COLUMN IF NOT EXISTS ai_tier TEXT CHECK (ai_tier IS NULL OR ai_tier IN ('hot','warm','cold')),
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_qualified_at TIMESTAMPTZ;

-- Index helps the leads list filter/sort by score.
CREATE INDEX IF NOT EXISTS idx_leads_org_score ON leads (organization_id, ai_score DESC NULLS LAST);
