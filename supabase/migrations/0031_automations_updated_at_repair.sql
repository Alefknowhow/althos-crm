-- Repair: garante que automations e automation_runs tenham updated_at,
-- exigido pelo trigger update_automations_updated_at criado em 0023.
--
-- Em algumas bases a coluna não foi criada (deploy parcial de 0004) e qualquer
-- UPDATE em automations falha com:
--   record "new" has no field "updated_at"
-- porque o trigger tenta setar NEW.updated_at = now().
--
-- Idempotente. Pode rodar mesmo se já estiver tudo certo.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
