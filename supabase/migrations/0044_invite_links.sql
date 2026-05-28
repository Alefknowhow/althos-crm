-- Invite links for agency clients (and any future invite-gated signups).
-- The super-admin generates a token and shares the /invite/<token> URL.
-- The user clicks, creates an account, and the org is provisioned with the
-- pre-defined plan — bypassing Asaas.

CREATE TABLE IF NOT EXISTS organization_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token         TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'agency',
  -- Optional: restrict to a specific email address
  email         TEXT,
  -- Optional: expiry (NULL = never expires)
  expires_at    TIMESTAMPTZ,
  -- Set when the invite is redeemed
  used_at       TIMESTAMPTZ,
  used_by_org   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only super-admins interact with this table; enable RLS so regular users
-- can't enumerate pending invites.
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Service-role (admin client) bypasses RLS — all invite operations from
-- server actions use the admin client.
