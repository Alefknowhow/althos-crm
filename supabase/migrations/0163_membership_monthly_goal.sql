-- Meta mensal individual por vendedor. Nullable de propósito: quando não
-- preenchida, o dashboard usa o fallback (meta da empresa ÷ nº de
-- vendedores ativos) — a lógica de fallback fica na camada de aplicação
-- (actions/dashboard-tabs.ts::getEffectiveSellerGoals), não aqui.
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS monthly_goal_cents INTEGER;

COMMENT ON COLUMN memberships.monthly_goal_cents IS
  'Meta de receita mensal individual do vendedor, em centavos. NULL = usa a meta da empresa dividida pelo número de vendedores ativos (fallback calculado em actions/dashboard-tabs.ts).';
