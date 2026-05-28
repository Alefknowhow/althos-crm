-- Anti-spam: public_request_log
--
-- Tracks public-facing endpoint hits per IP+endpoint so we can rate-limit
-- anonymous form submissions and public bookings. Org-less by design:
-- the FIRST request from a stranger has no org context yet.
--
-- See lib/security/antispam.ts → checkAndRecordRateLimit.

CREATE TABLE IF NOT EXISTS public_request_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The hot query is "count rows for (ip, endpoint) where at >= window_start".
-- Composite index ordered by at DESC keeps the recent window fast.
CREATE INDEX IF NOT EXISTS idx_public_request_log_ip_endpoint_at
    ON public_request_log (ip, endpoint, at DESC);

-- Auxiliary index for janitorial cleanup by age.
CREATE INDEX IF NOT EXISTS idx_public_request_log_at
    ON public_request_log (at);

-- RLS: writes are server-side only (admin client bypasses RLS). Lock down
-- to nobody from the anon role — defense in depth.
ALTER TABLE public_request_log ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. Service role still works.

-- Cleanup helper: drop rows older than 24h. Call from a cron / Inngest task.
CREATE OR REPLACE FUNCTION cleanup_public_request_log()
RETURNS void
LANGUAGE sql
AS $$
    DELETE FROM public_request_log WHERE at < NOW() - INTERVAL '24 hours';
$$;
