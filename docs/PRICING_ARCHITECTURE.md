# Pricing Architecture

> Fonte central de planos, entitlements e limites do Althos CRM. Se você está
> prestes a escrever `if (plan === 'business')` em algum componente/action,
> pare — a resposta certa quase sempre já existe aqui.

## Filosofia (repricing set/2026, migration `0244`)

```
PLANO BASE DA EMPRESA
+ USUÁRIOS INCLUÍDOS
+ USUÁRIOS ADICIONAIS
+ ALTHOS CREDITS
+ CONSUMO DE COMUNICAÇÃO (WhatsApp/Meta, Voice, SMS)
+ ADD-ONS / ENTERPRISE
```

Custos previsíveis (assinatura) separados de custos variáveis (uso). Ver [ALTHOS_CREDITS.md](./ALTHOS_CREDITS.md) para a parte de créditos e [BILLING.md](./BILLING.md) para a experiência de faturamento.

## Duas taxonomias de plano — por que ainda existem

O Althos tem duas gerações de modelo de plano coexistindo (isto é uma constatação do código real, não um design pretendido):

1. **Legada, por-ORGANIZAÇÃO** — `lib/billing/plans.ts` + `lib/billing/plans-data.ts`. `organizations.plan` ∈ `free/trial/starter/pro/business/scale/agency/internal`. Ainda gateia partes do app (`app/app/[orgSlug]/layout.tsx`, `lib/billing/limits.ts`, alguns `*-crud.ts`).
2. **Atual, por-CONTA** — `lib/plans/config.ts` + `lib/plans/server.ts`. Uma **conta** (`accounts`) pode ter N organizações. `PlanId = free|starter|pro|business`. Tabelas `plans` (catálogo global) + `subscriptions` (1 assinatura por conta). **Esta é a fonte de verdade para a repricing desta migration** — preço, franquia de créditos, usuários incluídos e feature flags vivem aqui.

A reconciliação das duas taxonomias (fazer a legada apontar 100% para a nova) **não foi feita nesta leva** — é um trabalho à parte, de maior risco (toca em todo gate existente), documentado como pendência.

## Plan Catalog (fonte central)

- **DB**: tabela `plans` (migration `0057`, evoluída em `0155`/`0244`) — `price_monthly_cents`, `price_semestral_cents`, `price_annual_cents`, `ai_credits_monthly`, `max_users`, `included_users`, `extra_user_price_cents`, `features` (jsonb), `max_*` (limites).
- **TS (mirror client-safe)**: `lib/plans/config.ts` — `PLAN_META`, `PLAN_FEATURES`, `PLAN_LIMITS`. **Nunca a fonte de enforcement** — só para a UI renderizar sem round-trip. Enforcement real é sempre via RPC (`account_has_feature`, `consume_ai_credits`).

### Preços vigentes (migration `0244`, decisão: migrar todas as contas, sem grandfathering — `subscriptions.legacy_plan_id`/`repriced_at` guardam o plano anterior por auditoria)

| Plano | Preço/mês | Usuários incluídos | Usuário extra | Althos Credits/mês |
|---|---|---|---|---|
| Starter | R$149 | 2 | R$39/mês | 500 |
| Pro | R$299 | 5 | R$49/mês | 2.500 |
| Business | R$599 | 10 | R$59/mês | 7.500 |
| Enterprise | Sob consulta | 20+ | Negociado | Negociado |

### Usuários incluídos/adicionais

`computeSeatCost(plan, totalUsers)` (`lib/plans/config.ts`) é a ÚNICA função que calcula custo de assento adicional. Retorna `{ totalUsers, includedUsers, extraUsers, extraUserPriceCents, extraCostCents }` — usado tanto pela UI ("5 de 5 incluídos" / "7 usuários: 5 incluídos + 2 adicionais = R$98/mês") quanto pelo cálculo de próxima fatura estimada.

`subscriptions.extra_seats` guarda quantos assentos adicionais a conta contratou (billing) — **não confundir** com a contagem real de `account_members`/`memberships` (uso). A reconciliação entre "assentos contratados" e "membros de fato" (cobrar automaticamente quando alguém excede a franquia) é uma pendência da Fase 5/6 (Billing Center + jobs de billing), não implementada nesta leva.

## Feature Entitlements

`FeatureKey` (`lib/plans/config.ts`) — ~15 chaves (`whatsapp`, `voice`, `ai_insights`, `multi_tenant`, etc.), espelhando `plans.features` (jsonb). Único ponto de enforcement real: RPC `account_has_feature(account_id, feature)` → `checkFeatureAccess()`/`checkFeatureAccessByOrgSlug()` (`lib/plans/server.ts`).

Regra: **nenhum módulo deve decidir sozinho** se um plano tem uma feature. Sempre `checkFeatureAccess()` no servidor. Alterar "Business passa a ter 15 usuários" ou "Pro ganha 4 WhatsApps" deve ser possível editando `plans` (DB) — sem tocar em componente.

## Limites (`PlanLimits`)

`pipelines`, `automations`, `automationRuns`, `socialAccounts`, `socialMessages`, `customers`, `users`, `leads`, `orgs`, `forms`, `storageMb`, `emailSends`. `-1` = ilimitado (mapeado para `Infinity` em `getPlanLimit()`). Nem todo limite listado no pedido original (`ai_agents`, `api_usage`, `webhooks`, `voice`, `sms`, `credits` como limite genérico) tem uma coluna própria ainda — a estrutura (`PlanLimits` interface + `PLAN_LIMITS` record) está preparada para receber novas chaves sem quebrar os consumidores existentes (todo acesso passa por `getPlanLimit(plan, key)`, nunca acesso direto ao objeto).

## Enterprise

Não implementado como fluxo de venda automatizado (fora de escopo desta leva, conforme o próprio pedido admite). A arquitetura não impede: `plans` é uma tabela comum — uma linha `enterprise` com limites/preço `null` (negociado) e `subscriptions` já suporta `payment_provider = 'manual'`. Criar de fato o plano Enterprise (linha na tabela + fluxo de onboarding assistido) é uma pendência explícita da próxima etapa.

## Credit packages (add-on de Althos Credits)

Tabela `credit_packages` (migration `0244`) — catálogo editável sem deploy, lido via `getCreditPackagesCatalog()` (`lib/credits/engine.ts`). Pacotes vigentes: 1.000/R$29 · 5.000/R$99 · 10.000/R$179 · 25.000/R$349 · 50.000/R$599. O array antigo `CREDIT_PACKS` (`lib/plans/config.ts`) fica marcado `@deprecated` — mantido só até a UI de compra migrar para o catálogo novo.

## Migração de clientes existentes

Decisão de negócio confirmada nesta sessão: **migrar todas as contas para o novo preço/franquia imediatamente** (não há opção de grandfathering habilitada). Para permitir auditoria/rollback de decisão comercial sem tocar em schema, `subscriptions` ganhou `legacy_plan_id` (snapshot do `plan_id` no momento da migration) e `repriced_at`. Isto NÃO é um mecanismo de grandfathering ativo — é só rastro de auditoria. Se o negócio decidir reverter para os preços antigos para uma conta específica, os dados para isso existem, mas a lógica de "aplicar plano legado" não foi construída (pendência).

## Risco real encontrado na Fase 5 e CORRIGIDO nesta leva (/upgrade + cobrança real)

`app/app/[orgSlug]/upgrade/page.tsx` (a "página de planos" dentro do app) lia `PUBLIC_PLANS`/`formatPrice(plan.priceCents)` de `lib/billing/plans-data.ts` (taxonomia legada), que ainda tinha os preços da repricing de set/2026 (R$167/397/697) — divergindo do Billing Center, já repricado (R$149/299/599) na própria Fase 5.

**Investigação revelou um problema pior**: existia uma TERCEIRA cópia de preço, em `lib/asaas/client.ts::planValue()` — hardcoded e nunca atualizada desde o lançamento (R$137/397/697), que é o valor **realmente cobrado** na assinatura Asaas quando o cliente clica em "Continuar para pagamento". Ou seja: o cliente via R$167 no Starter e era cobrado R$137 — undercharge real, silencioso, em produção.

**Corrigido** (não apenas documentado):
1. `lib/billing/plans-data.ts` — `PLANS.starter/pro/business.priceCents(Semestral/Annual)` atualizados para os valores repricados (R$149/299/599 + semestral −10%/anual −18%), a MESMA fonte que `getPlanPricing()` usa para `/upgrade` e o `CheckoutModal`.
2. `lib/asaas/client.ts::planValue()` — deixou de ter um mapa próprio hardcoded; agora lê os mesmos `priceCents`/`priceCentsSemestral`/`priceCentsAnnual` de `PLANS`. Preço exibido e preço cobrado agora vêm da MESMA fonte — não podem mais divergir.
3. `PLANS.scale` (alias legado de `business`, usado só por orgs já grandfathered nesse plano antigo) foi deliberadamente **mantido** no preço antigo (R$697) — mudar isso não afeta preço exibido a ninguém (não é `isPublicPlan`) e alterar retroativamente cobraria diferente de assinaturas Asaas já ativas, que são objetos remotos independentes; ajustar cobrança de assinaturas JÁ EXISTENTES exigiria uma chamada à API do Asaas por conta, isso sim uma tarefa de Fase 6 (migração ativa), não um ajuste de config.
4. Teste desatualizado corrigido: `tests/unit/billing-plans.test.ts` tinha asserções com o preço antigo do Pro (R$397/R$3.906,48 anual) — atualizado para R$299/R$2.942,64.

**O que NÃO foi corrigido, ainda pendente**: assinaturas Asaas já ativas de contas nos planos starter/pro/business (não-scale) continuam cobrando o valor com que foram criadas — mudar `PLANS` só afeta CHECKOUTS NOVOS a partir de agora, não retroage sobre assinaturas recorrentes já em andamento no Asaas. Ajustar o valor de assinaturas existentes (via `updateSubscriptionValue`, hoje sem nenhum caller) é uma decisão de negócio explícita (avisar o cliente antes de mudar o valor cobrado) — não deve ser automatizado sem essa combinação.

## Reconciliação de usuários incluídos/adicionais (2026-09-13, confirmado: sem clientes ativos na plataforma)

Usuário confirmou não haver clientes pagantes ainda — autorização explícita para atualizar valores sem se preocupar com grandfathering. Aproveitado para fechar 3 inconsistências reais encontradas:

1. **Bug funcional real**: `account_user_limit()` (RPC que efetivamente bloqueia convite de novo membro em `actions/team-invite.ts`) usava só `plans.max_users`, ignorando `subscriptions.extra_seats` — uma conta que comprasse assentos extras continuaria travada na franquia base, sem conseguir convidar ninguém a mais. Corrigido na migration `0246`: `account_user_limit()` agora soma `max_users + extra_seats`.
2. `lib/billing/plans-data.ts` (taxonomia legada): `maxUsers` de Starter/Pro/Business estava 1/6/20 (nunca atualizado desde antes da repricing) — sincronizado para 2/5/10, igual à franquia nova. `trial.maxUsers` também ajustado (6→5, espelha Pro).
3. `lib/plans/config.ts::PLAN_LIMITS.users` (mirror client-safe da taxonomia nova) estava 1/6/20 — sincronizado para 2/5/10 (igual a `plans.max_users`/`includedUsers`). Comentário adicionado deixando claro que este valor é a FRANQUIA, não o teto real de convite (que soma `extra_seats`).
4. `actions/billing.ts::activatePlanFromWebhook` — mapa `userLimits` (usado só pela taxonomia legada ao ativar plano via webhook) tinha `starter: 1` — corrigido para `2`.
5. `PLANS.scale` (alias legado de Business) teve o preço sincronizado com o valor repricado de Business (R$599) — decisão possível só porque não há assinatura Asaas real presa a esse valor ainda.

## Pendências (próxima etapa)

- Reconciliar a taxonomia legada (`organizations.plan`) com a nova — hoje há dois lugares onde "o plano da conta" pode, em teoria, divergir.
- Plano Enterprise como linha real na tabela `plans` + fluxo de onboarding.
- Auditoria completa dos ~30 pontos de `if (plan === ...)` espalhados pelo código legado (não removidos nesta leva — risco de regressão fora do escopo do Credit Engine).
- UI (Fase 5): página de planos, Billing Center, alertas de consumo, upgrade contextual.
