-- ============================================================================
-- 0250_organizations_refund_tracking.sql
-- Garantia de reembolso de 14 dias (reavaliação do teste grátis, set/2026):
-- o cliente paga na hora da assinatura em vez de ter um período gratuito
-- sem cartão; se cancelar dentro de 14 dias, o valor é devolvido.
--
-- `trial_ends_at` (coluna já existente) é REAPROVEITADA com um significado
-- novo pra contas que já pagaram: em vez de "quando o acesso gratuito
-- acaba", passa a significar "até quando a conta é elegível a reembolso
-- automático". `activatePlanFromWebhook` (actions/billing.ts) passa a
-- setar `trial_ends_at = now() + 14 days` em vez de NULL ao confirmar o
-- primeiro pagamento.
-- ============================================================================

alter table public.organizations
  add column if not exists refunded_at timestamptz;

comment on column public.organizations.trial_ends_at is
  'Para contas em trial legado: fim do acesso gratuito. Para contas que já pagaram (subscription_status active/trialing com asaas_subscription_id): fim da janela de reembolso automático de 14 dias (set em activatePlanFromWebhook). Nunca as duas coisas ao mesmo tempo.';
comment on column public.organizations.refunded_at is
  'Timestamp do estorno automático via garantia de 14 dias (actions/billing.ts::cancelSubscriptionWithRefund). NULL = nunca reembolsada.';
