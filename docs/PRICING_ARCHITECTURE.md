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

## Risco real e ativo encontrado durante a Fase 5 (não corrigido — precisa de decisão antes de tocar)

`app/app/[orgSlug]/upgrade/page.tsx` (a "página de planos" dentro do app, onde o cliente clica pra assinar/fazer upgrade) lê `PUBLIC_PLANS`/`formatPrice(plan.priceCents)` de **`lib/billing/plans.ts` — a taxonomia LEGADA**, que ainda mostra os preços antigos (R$167/397/697), não os repricados (R$149/299/599). O `UpgradeCheckoutButton` dessa página provavelmente cria a cobrança Asaas usando esse mesmo valor legado.

Isso significa que, HOJE, um cliente pode ver R$299/mês no painel de Assinatura (Billing Center, já corrigido na Fase 5) e R$397/mês na página de upgrade/checkout para o MESMO plano Pro — inconsistência visível e ativa.

**Por que não foi corrigido nesta leva**: mudar o preço exibido em `/upgrade` sem entender exatamente como `UpgradeCheckoutButton` monta a cobrança Asaas arrisca cobrar um valor e mostrar outro (pior que a inconsistência atual). Essa é exatamente a reconciliação de taxonomias que a Fase 2/3 já sinalizou como "alto risco, não fazer de afogadilho". Precisa ser a PRIMEIRA coisa da próxima sessão de Fase 6, antes de qualquer outra coisa — é um bug visível ao cliente pagante agora.

## Pendências (próxima etapa)

- Reconciliar a taxonomia legada (`organizations.plan`) com a nova — hoje há dois lugares onde "o plano da conta" pode, em teoria, divergir.
- Plano Enterprise como linha real na tabela `plans` + fluxo de onboarding.
- Auditoria completa dos ~30 pontos de `if (plan === ...)` espalhados pelo código legado (não removidos nesta leva — risco de regressão fora do escopo do Credit Engine).
- UI (Fase 5): página de planos, Billing Center, alertas de consumo, upgrade contextual.
