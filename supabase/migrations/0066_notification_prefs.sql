-- Per-user notification preferences.
--
-- A user opts categories of notifications in/out. Preferences are stored as a
-- single JSONB blob keyed by NotificationCategory (see lib/notifications/
-- categories.ts). Opt-out model: a missing/true value means the category is ON,
-- only an explicit `false` disables it.
--
-- Scoped per (user, organization) so the same person can have different
-- preferences in different organizations of the account.

CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- { "new_lead": true, "automation_failed": false, ... }
    prefs           JSONB NOT NULL DEFAULT '{}'::jsonb,

    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

-- Each user manages only their own preferences.
DROP POLICY IF EXISTS "Users manage own notification prefs" ON notification_prefs;
CREATE POLICY "Users manage own notification prefs"
    ON notification_prefs
    FOR ALL
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin client (service role) bypasses RLS to read prefs when gating pushes.

CREATE INDEX IF NOT EXISTS idx_notification_prefs_org
    ON notification_prefs (organization_id);

DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON notification_prefs;
CREATE TRIGGER update_notification_prefs_updated_at
BEFORE UPDATE ON notification_prefs
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
