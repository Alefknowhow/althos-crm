-- ============================================================================
-- 0247_voice_business_only.sql
-- Voice AI vira diferencial exclusivo do plano Business (repricing set/2026,
-- docs/PRICING_ARCHITECTURE.md § 2) — antes o Pro também tinha acesso
-- (plans.features.voice = true), divergindo da lista de benefícios que o
-- usuário pediu para a plataforma seguir. Sem clientes ativos na plataforma
-- (confirmado 2026-09-13) — mudança de entitlement segura.
-- ============================================================================

update public.plans set features = jsonb_set(features, '{voice}', 'false'::jsonb) where id = 'pro';
