-- ══════════════════════════════════════════════════════════════════════════
-- Member permissions & Team Invitations
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Add permissions to memberships ────────────────────────────────────────
-- Empty object = no restrictions (owner/admin see everything by default).
-- For members, the UI writes explicit booleans per module.

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

-- ── 2. Invitations table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      uuid        NOT NULL,          -- auth.users.id of the inviting owner/admin
  email           text        NOT NULL,
  role            text        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('admin', 'member')),
  permissions     jsonb       NOT NULL DEFAULT '{}',
  token           text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Only one pending invite per email per org
  UNIQUE (organization_id, email)
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Org owners/admins can read and manage their org's invitations
DROP POLICY IF EXISTS "admins manage invitations" ON invitations;
CREATE POLICY "admins manage invitations"
  ON invitations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_invitations_org     ON invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON invitations (email);
