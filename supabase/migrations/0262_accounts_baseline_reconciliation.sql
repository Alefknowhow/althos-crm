-- ============================================================================
-- 0262_accounts_baseline_reconciliation.sql
-- Issue #30 — fundação de Organizações/multi-org.
--
-- CONTEXTO (auditoria feita para #30): as tabelas `accounts` e
-- `account_members`, a coluna `organizations.account_id`/`account_type`, as
-- funções `get_user_accounts()`/`get_user_admin_accounts()`/
-- `fn_touch_accounts()` e as policies de `accounts`/`account_members` já
-- existem e estão em uso em produção (consumidas desde 0057_billing_plans.sql
-- em diante), mas NUNCA foram criadas por uma migration rastreada — foram
-- aplicadas fora do fluxo normal. Esta migration não muda comportamento: ela
-- só faz o histórico de migrations refletir o schema real (idempotente, sem
-- efeito em ambientes onde os objetos já existem).
--
-- Modelo confirmado: accounts (1) -> organizations (N); account_members é a
-- membership em nível de conta (role admin/member); memberships continua
-- sendo a membership em nível de organização (owner/admin/member).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabelas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  niche              text,
  owner_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  referral_code      text UNIQUE,
  preferred_ai_model text NOT NULL DEFAULT 'claude-haiku-4-5'
);

CREATE TABLE IF NOT EXISTS account_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id ON accounts(owner_user_id);

-- ----------------------------------------------------------------------------
-- 2) Coluna organizations.account_id / account_type
-- ----------------------------------------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'self_signup';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_account_type_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_account_type_check
      CHECK (account_type IN ('althos_managed', 'self_signup', 'internal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_account_id ON organizations(account_id);

-- ----------------------------------------------------------------------------
-- 3) RLS
-- ----------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_accounts()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT account_id FROM account_members WHERE user_id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_admin_accounts()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT account_id FROM account_members WHERE user_id = auth.uid() AND role = 'admin';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_touch_accounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_touch_accounts ON accounts;
CREATE TRIGGER trg_touch_accounts
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION fn_touch_accounts();

DROP POLICY IF EXISTS "Members read their account" ON accounts;
CREATE POLICY "Members read their account" ON accounts
  FOR SELECT
  USING (id IN (SELECT get_user_accounts()));

DROP POLICY IF EXISTS "Admins update their account" ON accounts;
CREATE POLICY "Admins update their account" ON accounts
  FOR UPDATE
  USING (id IN (SELECT get_user_admin_accounts()))
  WITH CHECK (id IN (SELECT get_user_admin_accounts()));

DROP POLICY IF EXISTS "Super admin read accounts" ON accounts;
CREATE POLICY "Super admin read accounts" ON accounts
  FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS "Members read account roster" ON account_members;
CREATE POLICY "Members read account roster" ON account_members
  FOR SELECT
  USING (account_id IN (SELECT get_user_accounts()));

DROP POLICY IF EXISTS "Admins manage account roster" ON account_members;
CREATE POLICY "Admins manage account roster" ON account_members
  FOR ALL
  USING (account_id IN (SELECT get_user_admin_accounts()))
  WITH CHECK (account_id IN (SELECT get_user_admin_accounts()));

DROP POLICY IF EXISTS "Super admin read account_members" ON account_members;
CREATE POLICY "Super admin read account_members" ON account_members
  FOR SELECT
  USING (is_super_admin());
