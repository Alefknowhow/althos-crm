# Architectural Decisions

Registro de decisões arquiteturais **relevantes** — não trivial, não
reversível-sem-custo, ou algo que um agente futuro precisa saber "por quê"
antes de mexer. Não registre decisões óbvias ou já cobertas por
`.harness/invariants.md`/`AGENTS.md`.

Formato:

```
## YYYY-MM-DD — Nome da decisão

Context:
Decision:
Reason:
Impact:
```

---

## 2026-09-11 — Protocolo de handoff entre agentes (.ai/)

Context: o projeto já tinha `.harness/tasks/` (planejamento de tarefas
maiores, lifecycle backlog→completed) e `AGENTS.md`/`CLAUDE.md` (regras de
workflow), mas nada cobria a transição de estado *entre agentes/sessões*
sem depender do histórico de chat — um agente novo (Claude Code ou Codex)
não tinha como saber rapidamente "o que estava em andamento agora" sem
reconstruir contexto do zero.

Decision: criar `.ai/{PROJECT_CONTEXT,CURRENT_TASK,HANDOFF,DECISIONS,KNOWN_ISSUES}.md`
como camada de continuidade, complementar (não substituta) ao `.harness/tasks/`.
`CURRENT_TASK.md` é o ponteiro rápido pro "agora"; tarefas grandes continuam
sendo planejadas em `.harness/tasks/active/<slug>.md` com o template
existente. `HANDOFF.md` separa uma seção **Automatic Context** (gerada por
`scripts/generate-handoff.mjs`, nunca editada à mão) de uma seção **Agent
Context** (semântica, escrita pelo agente) — pra reduzir a manutenção manual
sem arriscar sobrescrever análise/decisões já registradas.

Reason: evitar retrabalho de discovery entre handoffs e reduzir o risco de
dois agentes pisarem no mesmo código sem saber. Optou-se por markdown puro
(sem banco/serviço externo) para manter zero dependência nova e ficar
versionado junto com o código no próprio commit.

Impact: `AGENTS.md` ganhou uma seção de protocolo obrigatório (ler antes de
começar, atualizar antes de finalizar/transferir). Nenhuma funcionalidade do
CRM foi alterada — é infraestrutura de desenvolvimento apenas.

## 2026-09-13 — Repricing + Credit Engine (Althos Credits)

Context: pedido de 33 seções para reestruturar Pricing/Billing/Credits (novo
modelo comercial "plano base + usuários incluídos/extras + Althos Credits +
consumo de comunicação + add-ons"). Auditoria encontrou duas taxonomias de
plano coexistindo (`organizations.plan` legado vs. `accounts`/`subscriptions`
novo) e 3 ledgers de crédito paralelos (IA/Voice/Email) com código
duplicado.

Decision (confirmadas com o usuário antes de tocar em schema):
1. Repricing migra TODAS as contas para os novos valores (Starter R$149,
   Pro R$299, Business R$599; franquias 500/2.500/7.500 créditos) — sem
   grandfathering. `subscriptions.legacy_plan_id`/`repriced_at` guardam o
   plano anterior só para auditoria, não para reversão automática.
2. "Althos Credits" generaliza (não recria do zero) o `ai_credits`/
   `ai_credit_transactions` já existente — ganha idempotência, refund e
   metering de unit economics. As TABELAS não foram renomeadas (risco de
   migração destrutiva sem ganho real); o nome comercial vive só na UI/docs.
3. Voice e SMS continuam com billing de uso PRÓPRIO, fora do Credit Engine
   — não viram "Althos Credits" (exigência explícita do pedido original,
   seções 11-13).
4. Execução em blocos: esta sessão entregou Fase 2/3 (schema + Credit
   Engine), sem UI nova. Fases 4 (Voice/SMS metering completo), 5 (Billing
   Center/pricing page/admin), 6-10 ficam para as próximas sessões — ver
   `.ai/CURRENT_TASK.md`.

Reason: o pedido original é grande demais (schema + ~10 pontos de chamada
de IA + UI + admin + harness + docs) para uma sessão só sem risco de
regressão em billing de produção (alto blast radius, difícil de reverter).
Confirmar as decisões de negócio (repricing sem grandfathering, unificação
do ledger de IA) ANTES de tocar em schema evita retrabalho e protege
clientes pagantes reais.

Impact: migration `0244_althos_credits_engine.sql` aplicada em produção
(Supabase MCP). `lib/credits/engine.ts` (novo) é agora o único ponto de
entrada permitido para consumo/refund/catálogo de créditos —
`consumeAiCredits()` (usado por ~30 call sites de IA) virou wrapper fino
sobre ele, sem exigir reescrever esses call sites nesta leva. Um bug real
(nome de parâmetro SQL errado, `p_lead_id` em vez do real `p_contato_id`,
que criou uma função sobrecarregada órfã e removeu o bypass de
super-admin) foi cometido e corrigido dentro da própria sessão — ver
`.ai/HANDOFF.md` § Known Problems para o diagnóstico completo antes de
tocar em `consume_ai_credits` de novo.

## 2026-09-13 — Fase 4: Voice/SMS ganham idempotência/refund, SEM entrar no Credit Engine de IA

Context: continuação da tarefa de repricing/Credit Engine (decisão acima).
Auditoria do `lib/voice/credits.ts`/`consume_voice_credits` encontrou o
mesmo tipo de gap que a Fase 2/3 corrigiu para IA: nenhuma proteção de
idempotência (retry de `step.run` do Inngest reexecuta a função inteira) e
nenhuma função de estorno — se o provider (Twilio) falhasse depois do
débito, o cliente perdia o crédito sem receber a chamada/SMS. Confirmado
como bug REAL, não hipotético, ao ler `lib/inngest/voice-calls.ts` e
`lib/inngest/voice-sms.ts`: ambos debitavam e só marcavam status de falha,
sem estornar.

Decision:
1. Levar o Credit Engine de IA (idempotency_key + refund_of, migration
   `0244`) para `voice_credit_transactions` também (migration `0245`) —
   MESMO padrão, ledger SEPARADO. Voice/SMS continuam fora do conceito
   comercial "Althos Credits" (decisão da Fase 2/3, reafirmada aqui).
2. SMS não ganhou uma tabela `sms_usage` própria — continua usando
   `voice_credit_transactions` com `usage_type='sms'`. Reaproveitar em vez
   de duplicar uma segunda tabela de ledger para uma unidade de negócio
   pequena.
3. Em `voice-sms.ts`, o catch que estorna NÃO relança o erro — decisão
   deliberada: relançar faria o Inngest reprocessar o mesmo step com a
   MESMA idempotency key (`event.id`, estável entre retries), que
   encontraria a transação já estornada e devolveria um "idempotent
   replay" (sucesso, sem novo débito) — o reenvio sairia de graça. Parar o
   retry ali (retornar `skipped`) é o comportamento seguro.

Reason: mesma motivação da Fase 2/3 — billing é dado crítico, e um retry
que double-charga ou um provider-failure que nunca estorna são prejuízos
financeiros reais (não teóricos) para o cliente ou para a Althos.

Impact: `lib/voice/credits.ts` ganhou `refundVoiceCredits()` e
`buildVoiceIdempotencyKey()`; `consumeVoiceCredits()` aceita
`idempotencyKey` e retorna `transactionId`. `lib/inngest/voice-calls.ts` e
`lib/inngest/voice-sms.ts` corrigidos para estornar em falha pós-débito.
Mesmo cuidado da Fase 2/3 aplicado ao evoluir `consume_voice_credits`: como
adicionar um parâmetro muda a assinatura da função, um `DROP FUNCTION`
explícito da versão antiga veio antes do `CREATE OR REPLACE`, evitando
recriar o bug de overload órfão da migration 0244.

## 2026-09-13 — Fase 5: Billing Center UI + descoberta de um risco real (preços legados vs. repricados)

Context: continuação do bloco de pricing/billing (Fases 2/3/4 acima).
Implementar o Billing Center (usuários incluídos/adicionais, próxima
fatura estimada, alertas de consumo) exigiu ler a fundo
`app/app/[orgSlug]/assinatura/page.tsx`, que já buscava tanto `org.plan`
(taxonomia legada, `getPlan()`) quanto `subscription` (taxonomia nova,
`getSubscriptionByOrgSlug()`) — mas só usava a segunda para uma checagem
lateral (`canRefer`), nunca para exibir preço. Ao adicionar o bloco de
usuários (que só existe na taxonomia nova), ficou evidente que o preço
exibido no topo da página (via `plan.priceCents`, legado) e o preço usado
no novo cálculo de fatura estimada (via `newPlanMeta.priceMonthlyCents`,
repricado) divergiam NA MESMA TELA para o mesmo plano.

Decision:
1. Corrigir a própria página do Billing Center para ela mesma ser
   consistente: quando a conta já tem uma linha em `subscriptions`, TODO
   preço exibido nessa tela usa o valor repricado (`newPlanMeta`), não o
   legado. Contas sem `subscriptions` continuam mostrando o preço legado
   (não há dado novo pra usar).
2. NÃO estender essa correção para `app/app/[orgSlug]/upgrade/page.tsx`
   (a página de checkout/upgrade) nesta mesma leva — ela ainda lê
   `lib/billing/plans.ts` (preços legados) e provavelmente monta a
   cobrança Asaas com esse mesmo valor. Mudar só o texto exibido sem
   entender/testar o fluxo de cobrança arriscaria mostrar um preço e
   cobrar outro — pior que a inconsistência atual (visível, mas não afeta
   cobrança real). Documentado como risco ativo e prioridade #1 da próxima
   sessão, não "resolvido às pressas" agora.
3. Migrar a compra de pacotes de Althos Credits do array `@deprecated
   CREDIT_PACKS` para o catálogo central `credit_packages` (criado na Fase
   2/3, mas cuja UI nunca tinha sido migrada) — único call site, sem
   quebra de compatibilidade.
4. CTAs de upgrade contextual (seção 17 do pedido original) já existiam
   app-wide (`VoicePaywall.tsx` e o mesmo padrão em `relatorios/page.tsx`)
   — decisão de NÃO reconstruir isso, só documentar a descoberta.

Reason: um Billing Center internamente inconsistente (dois preços
diferentes pro mesmo plano, na mesma tela) é pior que não ter feito a
mudança — mina a confiança do cliente no painel de faturamento. Ao mesmo
tempo, "corrigir tudo de uma vez" tocando também no fluxo de checkout sem
entender como ele monta a cobrança é exatamente o tipo de pressa que gera
prejuízo financeiro real (cobrar errado) — vale mais documentar o risco
com precisão do que arriscar uma correção mal-entendida.

Impact: `app/app/[orgSlug]/assinatura/page.tsx` ganhou `displayPriceCents`
(resolve pro valor certo conforme a taxonomia da conta).
`actions/addons.ts::purchaseCreditPack` mudou de assinatura
(`packIndex: number` → `packId: string`) — único call site atualizado
junto. Um bug de exibição também corrigido de passagem:
`CreditsHistorySection.tsx` mostrava transações do tipo `refund` (novo,
Fases 2-4) como consumo (vermelho, "-") em vez de crédito devolvido
(verde, "+"). **Risco real e ativo documentado, não corrigido**: preço
legado vs. repricado divergem em `/upgrade` — ver
`docs/PRICING_ARCHITECTURE.md` § "Risco real e ativo".

## 2026-09-13 — Correção do preço de /upgrade: 3 cópias de preço, uma cobrando errado de verdade

Context: usuário pediu explicitamente para corrigir o risco documentado ao
final da Fase 5 ("corrige o /upgrade antes de continuar"). Investigação
(seguindo a cadeia real: `UpgradeCheckoutButton` → `CheckoutModal` →
`createCheckoutSession` (actions/billing.ts) → `asaas.createSubscription` →
`planValue()`) encontrou que o problema era maior do que "só a UI mostra
preço diferente": `lib/asaas/client.ts::planValue()` tinha um TERCEIRO mapa
de preço, hardcoded e nunca atualizado desde o lançamento (R$137/397/697),
e é ESSE valor — não o que aparece na tela — que vira o `value` da
assinatura Asaas de verdade. O comentário da função até dizia "Fonte
única: lib/billing/plans.ts", mas nunca foi de fato ligado a ela.

Decision:
1. Corrigir a causa raiz, não só o sintoma: `lib/billing/plans-data.ts`
   (`PLANS.starter/pro/business`) atualizado pros valores repricados
   (149/299/599), e `planValue()` reescrito para LER desses mesmos campos
   em vez de manter seu próprio mapa. Preço exibido e preço cobrado agora
   têm uma única fonte — não há uma quarta cópia escondida em algum lugar
   que eu não tenha visto, verificado por grep em todo o repo por qualquer
   um dos valores antigos (137/167/397/697 e seus totais semestral/anual).
2. `PLANS.scale` (alias legado, contas grandfathered no plano antigo)
   deliberadamente NÃO alterado — não é plano público, e mudar o número
   aqui não afeta o valor de uma assinatura Asaas já criada (é um objeto
   remoto independente); só mudaria o que uma tela mostrasse, sem efeito
   real, então não há necessidade.
3. NÃO ajustar assinaturas Asaas já ativas (`updateSubscriptionValue`,
   hoje sem caller nenhum) — mudar o valor cobrado de um cliente que já
   está pagando é uma decisão comercial que exige aviso prévio, não uma
   correção de bug a ser automatizada nesta leva.

Reason: o pedido do usuário foi direto ("corrige antes de continuar") — a
prioridade era eliminar o undercharge real (Starter cobrando R$137 em vez
do valor mostrado), não só alinhar textos. Rastrear até a chamada real da
API do Asaas (em vez de assumir que só a exibição estava errada) evitou
deixar a causa raiz intacta.

Impact: `lib/billing/plans-data.ts`, `lib/asaas/client.ts::planValue()`
corrigidos. `tests/unit/billing-plans.test.ts` tinha asserções presas ao
preço antigo do Pro — corrigidas. Nenhuma assinatura Asaas já ativa foi
tocada (ver ponto 3 acima) — isso seguirá cobrando o valor com que foi
criada até uma decisão de negócio explícita sobre reajustar clientes
existentes.
