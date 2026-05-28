-- Push notification subscriptions for PWA Web Push.
--
-- Each row represents one browser/device that opted in. A user can have
-- multiple subscriptions (phone + laptop + different browsers). We never
-- deduplicate by user_id — we send to ALL their active subscriptions so
-- notifications arrive on every opted-in device.
--
-- The endpoint + keys (p256dh, auth) are the Web Push Protocol's three
-- required values. They come straight from the browser's PushSubscription
-- object and are opaque to us — we just pass them to web-push.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- PushSubscription values from the browser.
    endpoint      TEXT NOT NULL,
    p256dh        TEXT NOT NULL,   -- client public key (base64url)
    auth          TEXT NOT NULL,   -- client auth secret (base64url)

    -- Optional UA string — useful for debugging "which device got the push".
    user_agent    TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,

    -- One endpoint per user — browser generates a fresh endpoint on every
    -- subscribe() call, so UPSERT on endpoint keeps the table tidy.
    UNIQUE (endpoint)
);

-- RLS: each user can only see/manage their own subscriptions.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
    ON push_subscriptions
    FOR ALL
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role (admin client) needs to read subscriptions to send pushes.
-- The policy above covers SELECT for the logged-in user; admin bypasses RLS.

-- Index for the two hot queries:
--   1. "give me all subscriptions for this user"  (on send)
--   2. "does this endpoint already exist?"        (on subscribe)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id, organization_id);
