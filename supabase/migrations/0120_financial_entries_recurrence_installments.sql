-- Redesign da tela de Lançamentos: recorrência com frequência configurável
-- (hoje é fixo "todo mês, 12x"), parcelamento como recurso independente da
-- recorrência, e campos complementares informativos.

ALTER TABLE financial_entries
  -- Recorrência expandida — substitui o binário is_recurring "todo mês, 12x".
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT
    CHECK (recurrence_frequency IN ('semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_until DATE,
  ADD COLUMN IF NOT EXISTS recurrence_infinite BOOLEAN NOT NULL DEFAULT false,

  -- Parcelamento — independente de recorrência (N fixo, intervalo em dias,
  -- não necessariamente mensal, ex.: cartão de crédito).
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER,
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER,

  -- Campos complementares informativos (opcionais).
  ADD COLUMN IF NOT EXISTS nota_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS numero_documento TEXT,
  ADD COLUMN IF NOT EXISTS projeto TEXT,
  ADD COLUMN IF NOT EXISTS unidade_negocio TEXT;

CREATE INDEX IF NOT EXISTS idx_financial_entries_installment_group ON financial_entries(installment_group_id);
