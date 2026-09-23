-- ============================================================================
-- 0264_account_verticals_rls_fix.sql
-- Corrige achados da revisão automática (Codex) na PR #37.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- P1: a policy "Admins manage account verticals" (FOR ALL) deixava qualquer
-- admin de conta inserir/alterar/apagar linhas de account_verticals direto
-- pela API REST pública do Supabase com o JWT normal dele — ou seja,
-- self-service de uma vertical "active", contornando por completo o fluxo
-- de compra/pagamento (Asaas/Server Action) que esta tabela foi desenhada
-- pra registrar. O comentário original já dizia "isto NÃO é compra
-- self-service liberada por RLS", mas a policy em si permitia exatamente
-- isso — a intenção não virou enforcement.
--
-- Mutação passa a ser exclusiva de caminho server-side confiável: as
-- funções em lib/verticals/account-verticals.server.ts já usam
-- createAdminClient() (service role, bypassa RLS), então não dependem
-- desta policy pra escrever. Usuários comuns (inclusive admin de conta)
-- ficam só com leitura.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage account verticals" ON account_verticals;

-- ----------------------------------------------------------------------------
-- P2: vertical_onboarding_progress só tinha a policy de membros da org
-- (get_user_organizations()) — sem a policy de super-admin que outras
-- tabelas de tenant (incl. account_verticals, linhas acima) já têm. Um
-- super-admin sem membership na org (impersonação/suporte) ficava sem
-- acesso a esta tabela.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admin manage vertical onboarding" ON vertical_onboarding_progress;
CREATE POLICY "Super admin manage vertical onboarding" ON vertical_onboarding_progress
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
