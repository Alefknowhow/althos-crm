-- Saved filters for the Leads list (and future entities).
-- entity is a string so the same table can hold filters for "leads",
-- "form_submissions", etc. once we expand the pattern.

CREATE TABLE IF NOT EXISTS saved_filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    entity TEXT NOT NULL,
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_org_entity ON saved_filters (organization_id, entity);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters (user_id, entity);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Saved filters access" ON saved_filters;
CREATE POLICY "Saved filters access" ON saved_filters FOR ALL
USING (
  organization_id IN (SELECT get_user_organizations())
  AND (is_shared = TRUE OR user_id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT get_user_organizations())
  AND user_id = auth.uid()
);
