-- Vertical Clínicas — Fase 9: Retornos. Reaproveita clinic_attendances.
-- next_return_date (já existia desde a Fase 5) — não cria uma entidade
-- nova de "retorno", só rastreia o que foi feito com a sugestão: criar
-- tarefa (Core), marcar como já agendado, ou dispensar.

ALTER TABLE clinic_attendances ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (return_status IN ('pendente', 'tarefa_criada', 'agendado', 'dispensado'));
ALTER TABLE clinic_attendances ADD COLUMN IF NOT EXISTS return_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN clinic_attendances.return_status IS
  'Estado da sugestão de retorno (next_return_date) — pendente até a equipe criar tarefa/agendar/dispensar manualmente.';
