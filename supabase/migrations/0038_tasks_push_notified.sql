-- Add push_notified_at to tasks so the hourly overdue-push cron doesn't
-- re-send a "you have overdue tasks" notification every hour for the same
-- already-notified tasks.
--
-- NULL  = never push-notified (pick it up on the next cron run).
-- value = timestamp of last push sent — skip until the task changes status
--         or the user marks it done.

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS push_notified_at TIMESTAMPTZ;

-- Index so the cron query (status='open' AND due_date < now AND push_notified_at IS NULL)
-- stays fast even with thousands of tasks.
CREATE INDEX IF NOT EXISTS idx_tasks_overdue_unpushed
    ON tasks (organization_id, due_date)
    WHERE status = 'open' AND push_notified_at IS NULL;
