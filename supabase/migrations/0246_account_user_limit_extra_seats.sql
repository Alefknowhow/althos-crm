-- ============================================================================
-- 0246_account_user_limit_extra_seats.sql
-- Corrige um bug funcional real do modelo "usuários incluídos + adicionais"
-- (migration 0244): account_user_limit(), a função que de fato BLOQUEIA
-- convites de novos membros (actions/team-invite.ts), usava só
-- plans.max_users — nunca somava subscriptions.extra_seats. Ou seja: mesmo
-- uma conta com assentos extras contratados/pagos continuava travada no
-- teto incluso do plano, sem conseguir convidar ninguém a mais.
--
-- Sem clientes ativos hoje (confirmado pelo usuário) — seguro corrigir a
-- regra de negócio diretamente, sem preocupação de quebrar assinatura em
-- produção.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.account_user_limit(p_account_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT p.max_users + COALESCE(s.extra_seats, 0)
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.account_id = p_account_id LIMIT 1), 1);
$$;

COMMENT ON FUNCTION public.account_user_limit IS 'Teto de usuários da conta = plans.max_users (franquia incluída) + subscriptions.extra_seats (assentos adicionais contratados). Usado por actions/team-invite.ts para bloquear convites acima do limite.';
