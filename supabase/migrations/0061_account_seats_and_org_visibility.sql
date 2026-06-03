-- 0061: account-level user seats + per-org visibility
-- Convidados/usuários passam a ser contados por CONTA (plano max_users).
-- Todo usuário da conta fica presente em todas as orgs; o admin da conta
-- controla a visibilidade por org via memberships.hidden.

-- 1) flag de visibilidade
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- 2) get_user_organizations: memberships diretas respeitam hidden;
--    admins da conta mantêm visão total (branch da conta).
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT m.organization_id
      FROM memberships m
     WHERE m.user_id = auth.uid()
       AND m.hidden = false
    UNION
    SELECT o.id
      FROM organizations o
      JOIN account_members am ON am.account_id = o.account_id
     WHERE am.user_id = auth.uid()
       AND am.role = 'admin';
END;
$function$;

-- 3) Backfill: cada usuário da conta presente em cada org da conta.
INSERT INTO memberships (organization_id, user_id, role, permissions, hidden)
SELECT o.id,
       am.user_id,
       CASE WHEN am.role = 'admin' THEN 'admin' ELSE 'member' END,
       CASE WHEN am.role = 'admin'
            THEN '{}'::jsonb
            ELSE '{"pipeline":true,"leads":true,"tasks":true,"calendar":true}'::jsonb
       END,
       false
FROM account_members am
JOIN organizations o ON o.account_id = am.account_id
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4) Helpers de assento (seat) por conta.
--    Limite vem do plano da conta (subscriptions -> plans.max_users); -1 = ilimitado.
--    Sem assinatura, assume tier free (1).
CREATE OR REPLACE FUNCTION public.account_user_limit(p_account_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT p.max_users
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.account_id = p_account_id
      LIMIT 1),
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.account_user_count(p_account_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM account_members WHERE account_id = p_account_id;
$$;
