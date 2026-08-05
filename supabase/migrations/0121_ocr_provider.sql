ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ocr_provider TEXT NOT NULL DEFAULT 'claude'
    CHECK (ocr_provider IN ('claude', 'gemini'));
