-- ---------------------------------------------------------------------------
-- 0047_trial_email_tracking
--
-- Adds two nullable timestamp columns to organizations so that the Inngest
-- trial-email crons can mark an org as "already notified" and avoid
-- sending duplicate emails.
--
--   trial_warning_sent_at  — set when the D-3 warning email is dispatched
--   trial_expired_sent_at  — set when the D+0 expiry email is dispatched
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_warning_sent_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_expired_sent_at  TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.organizations.trial_warning_sent_at IS
  'Timestamp when the "trial expiring in 3 days" warning email was last sent.';

COMMENT ON COLUMN public.organizations.trial_expired_sent_at IS
  'Timestamp when the "trial has expired" notification email was last sent.';
