-- Bloco 7 — Agendamentos: campos adicionais para tornar o sistema funcional.
-- Migration cumulativa em cima de 0028. Idempotente.

-- 1) event_types: descrição rica do evento + buffers + cor
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_types_org_active
  ON event_types (organization_id, is_active);

-- 2) appointments: campos para lead linking, UTMs, notificações
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_org_start
  ON appointments (organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_event_start
  ON appointments (event_type_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_lead
  ON appointments (lead_id);

-- 3) availabilities ganha event_type_id opcional para suportar
--    horários por tipo de evento (não só globais por org).
ALTER TABLE availabilities
  ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES event_types(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_availabilities_event_day
  ON availabilities (event_type_id, day_of_week);
