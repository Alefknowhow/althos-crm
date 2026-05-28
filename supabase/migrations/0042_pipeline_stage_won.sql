-- Add is_won / is_lost flags to pipeline_stages so the app knows
-- which stage represents "deal closed" (Purchase CAPI) and which
-- represents "deal lost" (NotQualified CAPI).

ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS is_won  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes: fast lookup of won/lost stages per pipeline.
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_is_won
  ON pipeline_stages (pipeline_id) WHERE is_won = true;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_is_lost
  ON pipeline_stages (pipeline_id) WHERE is_lost = true;
