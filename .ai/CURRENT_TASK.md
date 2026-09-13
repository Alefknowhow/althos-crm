# Current Task

> Reflete a tarefa em desenvolvimento agora, neste diretório de trabalho.
> Para tarefas maiores que justificam plano detalhado, o arquivo completo
> vive em `.harness/tasks/active/<slug>.md` (mesmo template) — este arquivo
> aqui é o ponteiro rápido "o que está rolando agora", sempre atualizado,
> mesmo para tarefas pequenas que não passam pelo `.harness/tasks/`.
>
> **Concorrência**: antes de começar a editar, confira `Owner`/`Branch`/
> `Started At` abaixo. Se outro agente/pessoa já está com uma tarefa ACTIVE
> aberta nesta mesma branch, leia o estado atual (`Completed`/`In Progress`/
> `Pending`) antes de tocar em qualquer arquivo — não sobrescreva o trabalho
> dele. Se a tarefa daqui for diferente da sua, e a branch permitir, prefira
> anotar a sua como uma nova entrada abaixo em vez de apagar a anterior.

## Title
Nova arquitetura de Pricing/Billing/Althos Credits — repricing + Credit Engine (Fase 2/3 de um pedido de 33 seções)

## Status
IN PROGRESS (Fases 2/3/4/5 de 10 concluídas — schema+Credit Engine+Voice/SMS metering+Billing Center UI; Fases 6-10 pendentes)

## Owner
Claude (Claude Code)

## Branch
master

## Started At
2026-09-13

## Goal
Implementar a filosofia comercial "plano base + usuários incluídos/extras +
Althos Credits + consumo de comunicação + add-ons", com entitlements
centralizados e um Credit Engine confiável (ledger, idempotência, refund).
Pedido completo tem 33 seções — ver `docs/PRICING_ARCHITECTURE.md`,
`docs/ALTHOS_CREDITS.md`, `docs/BILLING.md` para o mapeamento total.

## Scope
Fases 1-3 do pedido original (auditoria, arquitetura, schema+Credit Engine).
Fases 4 (integrações Voice/SMS/WhatsApp completas), 5 (frontend/Billing
Center/pricing page/admin), 6 (estratégia de migração ativa — hoje só
audit trail), 7 (testes de integração/concorrência real), 8 (harness
completo), 9 (este handoff — em andamento) seguem NA PRÓXIMA ETAPA.

## Acceptance Criteria
Ver seção 33 do pedido original do usuário (não replicado aqui por
brevidade — a lista completa de 16 critérios está na mensagem do usuário
desta sessão). Desta leva, atendidos: 1 (planos), parcial de 2
(entitlements já centralizados, não auditados ponta-a-ponta), 3 (ledger +
metering do Credit Engine), parcial de 5 (usuários incluídos/adicionais —
cálculo existe, UI não), 11 (typecheck+test pass), 12 (build não rodado
nesta leva — nenhuma mudança de UI/build que o exigisse).

## Completed
- Migration `0244_althos_credits_engine.sql`: repricing (Starter R$149/Pro
  R$299/Business R$599, franquias 500/2500/7500 créditos, usuários
  incluídos 2/5/10, preço de assento extra R$39/49/59) direto na tabela
  `plans` (fonte central — nenhuma conta precisou de UPDATE individual).
  `subscriptions.extra_seats`/`legacy_plan_id`/`repriced_at` adicionados.
  `ai_credit_transactions` ganhou `idempotency_key` (índice único parcial),
  `module`/`provider`/`model`/`internal_cost_cents` (unit economics),
  `refund_of` (índice único parcial — 1 estorno por transação). Tabela
  `credit_packages` criada (catálogo central de add-ons).
- **Bug real encontrado e corrigido durante a própria migration**: o
  primeiro `CREATE OR REPLACE FUNCTION consume_ai_credits(...)` usou
  `p_lead_id` como nome de parâmetro, mas o nome real (migration `0073`) é
  `p_contato_id` — como a assinatura (tipos+nomes) mudou, Postgres criou
  uma SEGUNDA função sobrecarregada em vez de substituir a existente, e a
  nova versão também tinha perdido o bypass de super-admin
  (`current_user_is_super_admin()`) que a função real já tinha. Corrigido
  com uma migration de fixup (`fix_consume_ai_credits_param_name`): DROP
  das duas versões + recriação única com o parâmetro certo e o bypass
  restaurado. Validado via `select oid::regprocedure from pg_proc where
  proname='consume_ai_credits'` (1 função só) + chamada de smoke-test com a
  assinatura posicional antiga de 5 argumentos.
- `lib/credits/engine.ts` (novo) — Credit Engine central: `consumeCredits()`,
  `refundCredits()`, `getCreditPackagesCatalog()`,
  `buildCreditIdempotencyKey()`.
- `lib/plans/server.ts::consumeAiCredits()` virou wrapper fino sobre o
  engine — mantém o shape/assinatura exatos para não exigir reescrever os
  ~30 call sites de IA existentes nesta leva.
- `lib/plans/config.ts`: `PlanMeta` ganhou `includedUsers`/
  `extraUserPriceCents`; `PLAN_META` atualizado com os novos valores;
  `computeSeatCost(plan, totalUsers)` novo (única função que calcula custo
  de assento adicional — nenhum componente deve recalcular isso).
  `CREDIT_PACKS` marcado `@deprecated` em favor do catálogo em
  `credit_packages`.
- Testes: `computeSeatCost` (5 casos), `buildCreditIdempotencyKey` (3
  casos) — `tests/unit/plans-config.test.ts` (estendido) +
  `tests/unit/credit-engine.test.ts` (novo). Asserções de preço/crédito
  desatualizadas (valores da repricing anterior) corrigidas no mesmo teste.
- `docs/PRICING_ARCHITECTURE.md`, `docs/ALTHOS_CREDITS.md`, `docs/BILLING.md`
  criados.
- `npx tsc --noEmit`: PASS. `npm test`: PASS (173/173, 22 arquivos).

## Completed (Fase 4 — adicionado nesta continuação)
- Migration `0245_voice_credits_idempotency.sql`: `voice_credit_transactions`
  ganhou `idempotency_key` (índice único parcial) e `refund_of` (índice
  único parcial). `consume_voice_credits` reescrita para ser idempotente e
  retornar `transaction_id`; nova função `refund_voice_credits`.
- **Mesmo tipo de bug de overload da migration 0244 evitado desta vez**:
  como adicionar `p_idempotency_key` muda a assinatura da função, um `DROP
  FUNCTION` explícito da assinatura antiga (7 args) veio ANTES do `CREATE OR
  REPLACE` (8 args) — verificado via `pg_proc` que existe só 1 overload
  antes e depois, e smoke-testado com a chamada posicional antiga.
- `lib/voice/credits.ts`: `consumeVoiceCredits()` aceita `idempotencyKey` e
  retorna `transactionId`; novo `refundVoiceCredits()`; novo
  `buildVoiceIdempotencyKey(usageType, refId)`.
- **2 bugs financeiros reais corrigidos** (não eram só "falta de rigor" —
  causavam perda de crédito sem entrega do serviço):
  - `lib/inngest/voice-calls.ts`: falha do provider (Twilio) DEPOIS da
    reserva de crédito nunca estornava — cliente perdia o crédito sem a
    chamada acontecer. Corrigido com `refundVoiceCredits` no catch, antes
    de marcar a chamada como `failed`. (Retry não duplica o débito porque o
    guard existente `call.status !== 'queued'` já bloqueia reprocessamento
    — a idempotency key aqui é defesa em profundidade, não a proteção
    principal.)
  - `lib/inngest/voice-sms.ts`: mesmo problema para SMS. Corrigido, com uma
    decisão de design importante: o catch NÃO relança o erro depois de
    estornar — se relançasse, o retry do Inngest reexecutaria o mesmo
    step com a MESMA idempotency key (baseada em `event.id`, estável entre
    retries), encontraria a transação já estornada e devolveria um
    "idempotent replay" reportando sucesso SEM debitar de novo — ou seja, o
    reenvio sairia de graça. Parar o retry (retornar `skipped` em vez de
    `throw`) evita esse under-charge; reenviar de verdade exige um novo
    evento (`event.id` novo).
  - `app/api/webhooks/voice/twilio/status/route.ts`: idempotency key
    adicionada na reconciliação de minutos extras (defesa em profundidade —
    já havia dedupe no nível do webhook via `voice_provider_events`, não
    era um bug ativo, mas ficou consistente com o resto do Credit Engine).
- Testes novos: `tests/unit/voice-credits.test.ts` (`buildVoiceIdempotencyKey`,
  3 casos). `npx tsc --noEmit`: PASS. `npm test`: PASS (176/176, 23
  arquivos).
- `docs/BILLING.md` atualizado com a seção Voice/SMS revisada e os 2 bugs
  corrigidos.

## Completed (Fase 5 — adicionado nesta continuação)
- `app/app/[orgSlug]/assinatura/page.tsx`: novo bloco "Usuários" (incluídos/
  adicionais, custo do assento extra via `computeSeatCost()`) e "Próxima
  fatura estimada" (plano + assentos extras) — só aparecem quando a conta
  já tem `subscriptions` (taxonomia nova); documentado como limitação
  esperada, não bug.
- `CreditsPurchaseSection.tsx`: card de IA renomeado para "Althos Credits"
  na copy; alerta de consumo 50/75/90/100% (`creditAlert()`) com mensagem
  inline + barra em destaque; compra de pacote migrada do array
  `@deprecated CREDIT_PACKS` para o catálogo central `credit_packages`
  (via `getCreditPackagesCatalog()`, prop `aiPacks` vinda do server).
- `actions/addons.ts`: `purchaseCreditPack(orgSlug, packIndex: number)` →
  `purchaseCreditPack(orgSlug, packId: string)`, resolvendo preço no
  catálogo central em vez do array hardcoded (único call site, atualizado
  junto). `getCreditPacks()` idem.
- `CreditsHistorySection.tsx`: bug de exibição corrigido — linhas do tipo
  `refund` (novo, Fase 2/3/4) apareciam como consumo (vermelho, "-") em vez
  de crédito devolvido (verde, "+"); também renomeado "Créditos de IA" →
  "Althos Credits".
- **Descoberta, não construída**: CTAs de upgrade contextual (seção 17 do
  pedido) já existem app-wide (`VoicePaywall.tsx` e o mesmo padrão em
  `relatorios/page.tsx`) — nenhuma mudança necessária, documentado em
  `docs/BILLING.md` pra não ser reconstruído à toa numa sessão futura.
- `npx tsc --noEmit`: PASS. `npm test`: PASS (176/176 — sem teste novo
  nesta leva, mudanças foram de UI/wiring, não lógica pura nova).
  `npx eslint` nos arquivos tocados: 0 erros, 21 warnings (todos
  pré-existentes ou do mesmo tipo já tolerado no projeto — complexidade de
  função, `any`, console.error direto).

## Completed (correção do preço de /upgrade — pedida explicitamente pelo usuário logo após a Fase 5)
- Investigação encontrou um problema PIOR do que o documentado ao final da
  Fase 5: existiam TRÊS cópias de preço, não duas. Além da taxonomia legada
  (`lib/billing/plans-data.ts`, R$167/397/697) e da nova repricada
  (`lib/plans/config.ts`, R$149/299/599), havia uma TERCEIRA em
  `lib/asaas/client.ts::planValue()` — hardcoded, nunca atualizada desde o
  lançamento (R$137/397/697), e é ESSE valor que é realmente cobrado na
  assinatura Asaas. Ou seja: cliente via R$167 no Starter e era cobrado
  R$137 — undercharge real e silencioso em produção, não só inconsistência
  visual.
- Corrigido: `PLANS.starter/pro/business` em `lib/billing/plans-data.ts`
  atualizados pros valores repricados (149/299/599 + semestral/anual).
  `planValue()` em `lib/asaas/client.ts` deixou de ter mapa próprio — passou
  a ler os mesmos campos de `PLANS`. Preço exibido (`/upgrade`,
  `CheckoutModal`) e preço cobrado (Asaas) agora vêm da MESMA fonte.
- `PLANS.scale` (alias legado de business, contas grandfathered) mantido
  no preço antigo de propósito — mudar isso não muda o que ninguém vê (não
  é plano público) e não afeta assinaturas Asaas já ativas, que são
  objetos remotos independentes.
- Teste desatualizado corrigido: `tests/unit/billing-plans.test.ts` tinha
  asserções com o preço antigo do Pro (annual R$3.906,48) — atualizado
  para R$2.942,64.
- `npx tsc --noEmit`: PASS. `npm test`: PASS (176/176).
- **Ainda pendente, decisão de negócio explícita necessária**: assinaturas
  Asaas JÁ ATIVAS de contas starter/pro/business continuam cobrando o
  valor com que foram criadas — mudar `PLANS` só afeta checkouts NOVOS a
  partir de agora. Ajustar assinaturas existentes exige `updateSubscriptionValue`
  (hoje sem nenhum caller) + avisar o cliente antes — não deve ser
  automatizado sem essa combinação.

## Completed (reconciliação de usuários incluídos/adicionais — usuário confirmou não haver clientes ativos, autorizou prosseguir)
- **Bug funcional real corrigido**: migration `0246` —
  `account_user_limit()` (RPC que bloqueia convite de membro em
  `actions/team-invite.ts`) somava só `plans.max_users`, ignorando
  `subscriptions.extra_seats` — uma conta com assentos extras comprados
  continuava travada na franquia base. Corrigido: agora soma os dois.
  Smoke-testado via SQL direto (franquia 10 + 3 extra = limite 13).
  **Nota de processo**: durante o smoke-test deixei `extra_seats=3` preso
  numa conta real por engano (um `UPDATE ... LIMIT 1` sem filtro
  determinístico não resetou a mesma linha que eu tinha alterado) —
  detectado na query de verificação seguinte e revertido imediatamente
  (`UPDATE ... WHERE account_id = X AND extra_seats = 3`). Nenhum outro
  registro foi afetado (confirmado via `count(*) WHERE extra_seats <> 0` =
  0 depois do reset).
- `lib/billing/plans-data.ts`: `maxUsers` de Starter/Pro/Business (e
  `trial`) sincronizado de 1/6/20 (nunca atualizado antes) para 2/5/5/10
  — igual à franquia nova. `PLANS.scale` (alias legado) teve o preço
  sincronizado com Business (R$599) — só possível porque não há
  assinatura Asaas real presa a esse valor ainda.
- `lib/plans/config.ts::PLAN_LIMITS.users`: sincronizado de 1/6/20 para
  2/5/10, com comentário deixando explícito que é a FRANQUIA, não o teto
  real (que soma `extra_seats`).
- `actions/billing.ts::activatePlanFromWebhook`: `userLimits.starter`
  corrigido de 1 para 2.
- `npx tsc --noEmit`: PASS. `npm test`: PASS (176/176).

## In Progress
Nada em edição no momento.

## Pending
- ~~RISCO REAL ATIVO: /upgrade mostrava preço legado~~ **CORRIGIDO nesta
  mesma sessão, continuação** — ver "Completed (correção do preço de
  /upgrade)" abaixo e `docs/PRICING_ARCHITECTURE.md`.
- **Fase 5 (resíduo)** — alertas de consumo só no card de Althos Credits,
  não em Voice/Email (mesma função pode ser copiada). Reconciliar as duas
  taxonomias de plano para que toda conta (não só as já migradas pra
  `subscriptions`) mostre usuários incluídos/fatura estimada. Pricing page
  pública (marketing) não existe neste repo — confirmado, é outro projeto,
  não é uma lacuna. Admin interno (MRR, margem de IA por conta) não tocado.
- **Fase 4 (resíduo)** — `voice_minutes` com breakdown de custo por
  componente (telefonia/STT/LLM/TTS) não existe como tabela dedicada (hoje
  só custo total). Tabela `sms_usage` dedicada não foi criada — decisão
  pragmática de manter SMS no ledger de Voice (`usageType: 'sms'`) em vez
  de duplicar infraestrutura; documentado em `docs/BILLING.md`, não é uma
  lacuna, é uma escolha — revisitar se o produto precisar de métricas de
  SMS separadas de Voice no futuro.
- **Fase 5** — Billing Center (bloco de usuários incluídos/extras, próxima
  fatura estimada, histórico de Althos Credits com filtros, alertas de
  50/75/90/100%), página de planos pública, upgrade contextual, Admin
  interno (MRR, margem de IA, ação manual de crédito com audit log).
- **Fase 6** — estratégia de migração ATIVA (hoje só existe o audit trail
  `legacy_plan_id`/`repriced_at`; a decisão de negócio foi migrar todo
  mundo direto, então não há um mecanismo de "aplicar plano legado" a
  construir, mas isso deve ser confirmado antes de considerar a Fase 6
  encerrada).
- **Fase 7** — testes de concorrência/idempotência real (múltiplos
  workers debitando a mesma conta simultaneamente) — não há suíte de
  integração configurada no projeto (confirmado no CLAUDE.md); os testes
  desta leva são só das funções puras (seat cost, idempotency key). Testar
  a RPC `consume_ai_credits` sob concorrência real exige infraestrutura de
  teste de integração que não existe ainda.
- **Fase 8** — auditoria completa do harness (`.harness/`) — não feita
  nesta leva; só a documentação de billing (`docs/*.md`) foi escrita.
- Reconciliação da taxonomia legada (`organizations.plan`) com a nova
  (`accounts`/`subscriptions`) — não tocada, é uma mudança de alto risco à
  parte.
- `monthly_grant` como linha de ledger explícita (hoje a franquia é criada
  implicitamente no primeiro consumo do período).
- Auditoria dos ~30 pontos de `if (plan === ...)` espalhados no código
  legado — não removidos/centralizados nesta leva.
- Plano Enterprise como linha real em `plans` (hoje só documentado como
  arquitetura preparada, não criado).

## Files Involved
- `supabase/migrations/0244_althos_credits_engine.sql` (novo)
- `lib/credits/engine.ts` (novo)
- `lib/plans/config.ts`, `lib/plans/server.ts`
- `tests/unit/plans-config.test.ts`, `tests/unit/credit-engine.test.ts` (novo)
- `docs/PRICING_ARCHITECTURE.md`, `docs/ALTHOS_CREDITS.md`, `docs/BILLING.md` (novos)

## Dependencies
Nenhuma migration/PR concorrente conhecida sobre `plans`/`subscriptions`/
`ai_credits`/`ai_credit_transactions` no momento desta leva (verificado via
`git status`/`git diff` antes de commitar — outra sessão está ativa no
mesmo working directory, mas em áreas não relacionadas a billing).

## Notes
Pedido original do usuário tem 33 seções — grande demais para uma sessão
só. Decisão explícita (confirmada com o usuário via pergunta direta antes
de tocar em schema): (1) repricing migra TODAS as contas, sem
grandfathering; (2) unificar o conceito de Althos Credits num único ledger
central para IA (Voice/SMS continuam com billing de uso próprio, fora do
Credit Engine — por design, não por lacuna); (3) começar pela Fase
2/3 (schema+engine) antes de tocar em UI. Próxima sessão deve continuar
pela Fase 4 (Voice/SMS/WhatsApp) ou Fase 5 (Billing Center UI) — ambas
dependem do que foi construído aqui, nenhuma bloqueia a outra.
