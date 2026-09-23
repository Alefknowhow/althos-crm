-- ============================================================================
-- 0263_account_verticals_and_vertical_onboarding.sql
-- Issue #32 — fundação de dados para "Vertical pode ser adquirida
-- posteriormente" e "Core Onboarding / Vertical Onboarding separados".
--
-- ESCOPO DELIBERADAMENTE LIMITADO: esta migration NÃO mexe em checkout,
-- Asaas, subscriptions ou qualquer código que move dinheiro (auditoria #32
-- encontrou que /assinatura, /upgrade, CheckoutModal e o webhook do Asaas já
-- são um fluxo real e funcionando — mudar isso sem sandbox de pagamento pra
-- testar é risco desproporcional pra uma fatia de fundação). O que ela
-- resolve é um gap de MODELO DE DADOS: `organizations.niche`/`accounts.niche`
-- é hoje um campo único e imutável (setado uma vez no onboarding, sem
-- nenhum caminho de atualização em todo o código — auditoria #31/#32), o
-- que impede modelar "uma conta comprou a vertical de Viagens depois de já
-- estar no Core" como um evento distinto de "a org nasceu como Viagens".
--
-- `account_verticals` é esse registro — por CONTA (não por org, mesmo
-- padrão de `subscriptions`), com estado (mesmos 5 estados de
-- lib/capabilities/entitlement-state.ts), origem/motivo (nunca concessão
-- silenciosa, requisito da #33) e quem concedeu. Não é consumida ainda por
-- nenhuma checagem de capability/nicho existente (isso seguiria imutável
-- via `organizations.niche` até uma decisão de produto sobre permitir
-- múltiplas verticais ativas por org simultaneamente) — é o registro de
-- entitlement que uma automação de compra (ou uma concessão manual do
-- Super Admin, #33) escreve, pronto pra UI/relatório consumir.
--
-- `vertical_onboarding_progress` é o onboarding por vertical, independente
-- do onboarding Core existente (`organizations.onboarding_step`/
-- `onboarding_completed_at`, inalterados) — permite que a vertical tenha
-- seu próprio fluxo resumível sem reescrever o onboarding Core.
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_verticals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  vertical       text NOT NULL CHECK (vertical IN ('viagens', 'trafego', 'clinicas', 'imoveis', 'seguros', 'advocacia')),
  -- Mesmos 5 estados de lib/capabilities/entitlement-state.ts — billing
  -- state (subscriptions.status) e entitlement state (aqui) são conceitos
  -- separados por design (issue #31/#32).
  status         text NOT NULL DEFAULT 'pending_activation'
                 CHECK (status IN ('active', 'pending_activation', 'pending_cancellation', 'suspended', 'inactive')),
  granted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Obrigatório: nenhuma concessão (automática ou manual) fica sem motivo
  -- registrado — requisito explícito da #33 ("concessão manual não cria
  -- compra fictícia. Registrar origem/motivo").
  granted_reason text NOT NULL,
  activated_at   timestamptz,
  canceled_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, vertical)
);

CREATE INDEX IF NOT EXISTS idx_account_verticals_account ON account_verticals(account_id);

CREATE OR REPLACE FUNCTION public.fn_touch_account_verticals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_touch_account_verticals ON account_verticals;
CREATE TRIGGER trg_touch_account_verticals
  BEFORE UPDATE ON account_verticals
  FOR EACH ROW EXECUTE FUNCTION fn_touch_account_verticals();

ALTER TABLE account_verticals ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer membro da conta. Escrita: só admin da conta (mesmo
-- padrão de `accounts`/`account_members`, migration 0262) — isto NÃO é
-- "compra self-service liberada por RLS": a ação de compra real (quando
-- existir) ainda precisa passar por Server Action com checkFeatureAccess/
-- Asaas antes de chegar aqui; esta policy só define quem PODE ver/editar a
-- linha depois que ela existe (ex.: o próprio Super Admin usa o admin
-- client, que bypassa RLS deliberadamente).
DROP POLICY IF EXISTS "Members read account verticals" ON account_verticals;
CREATE POLICY "Members read account verticals" ON account_verticals
  FOR SELECT
  USING (account_id IN (SELECT get_user_accounts()));

DROP POLICY IF EXISTS "Admins manage account verticals" ON account_verticals;
CREATE POLICY "Admins manage account verticals" ON account_verticals
  FOR ALL
  USING (account_id IN (SELECT get_user_admin_accounts()))
  WITH CHECK (account_id IN (SELECT get_user_admin_accounts()));

DROP POLICY IF EXISTS "Super admin read account verticals" ON account_verticals;
CREATE POLICY "Super admin read account verticals" ON account_verticals
  FOR SELECT
  USING (is_super_admin());

-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertical_onboarding_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vertical        text NOT NULL CHECK (vertical IN ('viagens', 'trafego', 'clinicas', 'imoveis', 'seguros', 'advocacia')),
  step            int NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vertical)
);

CREATE INDEX IF NOT EXISTS idx_vertical_onboarding_org ON vertical_onboarding_progress(organization_id);

CREATE OR REPLACE FUNCTION public.fn_touch_vertical_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_touch_vertical_onboarding ON vertical_onboarding_progress;
CREATE TRIGGER trg_touch_vertical_onboarding
  BEFORE UPDATE ON vertical_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION fn_touch_vertical_onboarding();

ALTER TABLE vertical_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage their vertical onboarding" ON vertical_onboarding_progress;
CREATE POLICY "Org members manage their vertical onboarding" ON vertical_onboarding_progress
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));
