alter table automations add column if not exists flow jsonb;
alter table automation_runs add column if not exists current_step_id text;
alter table automation_runs add column if not exists waiting_for_step_id text;
