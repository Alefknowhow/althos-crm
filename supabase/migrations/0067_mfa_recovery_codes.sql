-- Two-factor authentication (2FA) recovery codes.
--
-- The TOTP factor itself lives in Supabase's managed `auth.mfa_factors` table
-- and is driven by the `supabase.auth.mfa.*` API. Supabase has no native concept
-- of "recovery codes", so we store our own here.
--
-- A recovery code is a single-use secret the user keeps offline. If they lose
-- their authenticator device, redeeming a valid code removes all of their MFA
-- factors (server-side, via the admin API) so they regain access at password-only
-- level and can re-enroll. Codes are stored hashed (sha256) — never in plaintext.

CREATE TABLE IF NOT EXISTS user_recovery_codes (
    id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- sha256 hex of the normalized code (lowercase, dashes stripped).
    code_hash  TEXT NOT NULL,

    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users may read their own codes (to count how many remain). Generation and
-- redemption happen through server actions using the service-role client, which
-- bypasses RLS — so no insert/update/delete policy is granted to end users.
DROP POLICY IF EXISTS "Users read own recovery codes" ON user_recovery_codes;
CREATE POLICY "Users read own recovery codes"
    ON user_recovery_codes
    FOR SELECT
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user
    ON user_recovery_codes (user_id)
    WHERE used_at IS NULL;
