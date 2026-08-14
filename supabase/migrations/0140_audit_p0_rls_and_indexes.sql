-- Fase 1 (P0) da auditoria de escalabilidade — correções de banco.

-- 1) get_user_organizations()/can_access_org()/is_super_admin() eram
--    VOLATILE, usadas em 43 policies de RLS. VOLATILE impede o planner de
--    Postgres de cachear o resultado por statement — é reavaliada por linha
--    em vez de uma vez por query. São puramente leitura, sem side effects.
ALTER FUNCTION get_user_organizations() STABLE;
ALTER FUNCTION can_access_org(uuid) STABLE;
ALTER FUNCTION is_super_admin() STABLE;

-- 2) profiles/marketing_leads tinham RLS habilitado sem NENHUMA policy —
--    bloqueava 100% do acesso via anon/authenticated. Ambas já eram lidas/
--    escritas só via service-role client de propósito (profiles não tem
--    organization_id, uma policy "authenticated lê tudo" vazaria e-mail
--    entre tenants). Adiciona só o mínimo seguro.
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admin access" ON public.profiles
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin access" ON public.marketing_leads
  FOR SELECT USING (is_super_admin());

-- 3) Índices compostos faltando em whatsapp_conversations/whatsapp_messages
--    (espelhando o padrão já correto em social_conversations/social_messages).
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org_last_message
  ON whatsapp_conversations (organization_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_created
  ON whatsapp_messages (conversation_id, created_at);

-- Índices redundantes identificados na auditoria.
DROP INDEX IF EXISTS idx_contatos_created_at;
DROP INDEX IF EXISTS idx_social_conversations_lookup;

-- 4) Funções SECURITY DEFINER que mexem em créditos de IA, cupons,
--    indicações e criação de organização estavam executáveis pelo role
--    `anon` (sem login). Todos os call-sites reais usam o client com sessão
--    do usuário (authenticated) ou o admin client (service_role) — nenhum
--    fluxo legítimo precisa delas sem login.
REVOKE EXECUTE ON FUNCTION consume_ai_credits(uuid, text, integer, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION redeem_coupon(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION redeem_referral(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION create_organization_for_user(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION create_organization_for_user(text, text, text) FROM anon;
-- Só chamada via service-role (painel super-admin) — nem authenticated precisa.
REVOKE EXECUTE ON FUNCTION create_organization_for_user_manual(text, text, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION create_organization_for_user_manual(text, text, uuid, text, text) FROM authenticated;
