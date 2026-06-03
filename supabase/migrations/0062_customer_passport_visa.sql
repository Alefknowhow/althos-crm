-- 0062: passaporte + visto americano no cadastro de clientes
-- Campos adicionais em customer_profiles (úteis para agências de viagens).

ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS has_us_visa BOOLEAN NOT NULL DEFAULT FALSE;
