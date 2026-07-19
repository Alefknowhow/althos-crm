-- ══════════════════════════════════════════════════════════════════════════
-- Meta mensal de receita — usada como linha de referência no gráfico
-- "Receita vs. meta" da Inicial (aba Visão Geral). Nullable: sem meta
-- definida, o gráfico não desenha a linha.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.organizations
  add column if not exists monthly_revenue_goal_cents integer;
