-- Add last_activity_at to leads so the automation stale-lead cron can
-- efficiently find leads that haven't been contacted in N days.
--
-- The column is kept in sync by a BEFORE INSERT trigger on lead_activities:
-- every new activity updates the parent lead's last_activity_at timestamp.
--
-- Backfill: set to the most recent activity, or to the lead's created_at
-- if no activity exists yet.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill existing leads
UPDATE leads l
SET    last_activity_at = COALESCE(
         (SELECT MAX(a.created_at)
          FROM   lead_activities a
          WHERE  a.lead_id = l.id),
         l.created_at
       )
WHERE  last_activity_at IS NULL;

-- Index for the daily cron query:
--   WHERE organization_id = $1 AND last_activity_at < cutoff
CREATE INDEX IF NOT EXISTS idx_leads_last_activity
  ON leads (organization_id, last_activity_at);

-- Trigger function: update last_activity_at on every new lead_activity row
CREATE OR REPLACE FUNCTION trg_update_lead_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE leads
  SET    last_activity_at = NEW.created_at
  WHERE  id = NEW.lead_id
    AND  (last_activity_at IS NULL OR last_activity_at < NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_lead_last_activity ON lead_activities;
CREATE TRIGGER update_lead_last_activity
AFTER INSERT ON lead_activities
FOR EACH ROW EXECUTE FUNCTION trg_update_lead_last_activity();
