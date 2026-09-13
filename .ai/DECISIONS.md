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

## 2026-09-13 — Confirmado: sem clientes ativos, reconciliação de usuários incluídos/adicionais liberada

Context: usuário confirmou explicitamente que não há clientes pagantes
ativos na plataforma ainda ("vamos atualizar os valores, não temos
clientes ativos, pode prosseguir"). Isso remove a principal razão de
cautela usada nas decisões anteriores desta sessão (preservar
grandfathering, não tocar em valores que pudessem afetar cobrança real).

Decision: aproveitar a permissão para fechar um bug funcional real
encontrado ao investigar o modelo de "usuários incluídos + adicionais":
`account_user_limit()` (a função que de fato bloqueia convite de novo
membro) somava só `plans.max_users`, nunca `subscriptions.extra_seats` —
uma conta que comprasse assentos extras continuaria travada na franquia
base, sem conseguir convidar ninguém a mais. Corrigido na migration
`0246`. Também sincronizados os valores de `maxUsers`/`PLAN_LIMITS.users`
que estavam desatualizados desde antes da repricing (1/6/20 → 2/5/10) em
`lib/billing/plans-data.ts`, `lib/plans/config.ts` e
`actions/billing.ts::activatePlanFromWebhook`.

Reason: a autorização explícita do usuário (sem clientes ativos) torna
esses ajustes de baixo risco — antes, mudar `maxUsers`/limites de
enforcement teria efeito real sobre contas pagantes; agora não há esse
efeito colateral. Fechar a lacuna de `extra_seats` era necessário de
qualquer forma para o modelo comercial "usuários incluídos + adicionais"
funcionar de verdade — sem isso, vender um assento extra não desbloquearia
nada na prática.

Impact: `supabase/migrations/0246_account_user_limit_extra_seats.sql`
aplicada. **Incidente de processo durante o smoke-test, corrigido na
hora**: um `UPDATE ... LIMIT 1` de teste (sem filtro determinístico por
`account_id`) deixou `extra_seats=3` preso numa conta real por engano —
detectado na query de verificação seguinte (o resultado não batia com o
esperado) e revertido imediatamente com um `UPDATE` filtrado por
`account_id` + `extra_seats=3`. Confirmado via `count(*) WHERE
extra_seats <> 0 = 0` depois do reset que nenhum outro registro ficou
afetado. Lição para não repetir: ao testar uma mutação em produção via
SQL direto, sempre capturar o `account_id` afetado ANTES de mutar (não
usar `LIMIT 1` solto em UPDATE/SELECT separados — a ordem não é garantida
entre chamadas), e sempre confirmar o estado revertido com uma query
separada antes de seguir.

## 2026-09-13 — Fase 6: lista de benefícios atualizada + Voice vira exclusividade Business

Context: usuário pediu pra continuar a Fase 6, lembrando 3 coisas: (1)
disparos de e-mail de campanha também são cobrados por crédito, (2)
atualizar a lista de benefícios ligada aos planos, (3) Business é R$599
até 10 usuários — atualizar benefícios/limites em Assinatura/Upgrade.

Decision:
1. Confirmado (não precisou construir): TODO envio de e-mail — incluindo
   disparos de campanha — já passa por `consumeEmailCredits()`
   (`lib/inngest/functions.ts::sendEmail`), implementado numa sessão
   anterior a esta. A tabela de benefícios (`lib/billing/plan-features.ts`)
   só precisava deixar isso EXPLÍCITO na copy ("Consome Email Credits"),
   não é uma feature nova a implementar.
2. `PLAN_FEATURES` (tabela de benefícios de `/upgrade`/`CheckoutModal`)
   reescrita seguindo a estrutura exata que o usuário definiu na sessão de
   repricing original (CRM em todos os planos → Automações/Agentes de
   IA/Financeiro/Produtos/Integrações/API/MCP a partir do Pro → Voice
   AI/SMS/múltiplas unidades/permissões avançadas/auditoria só Business).
3. **Mudança de entitlement real, não só de copy**: ao escrever a tabela
   nova, percebi que `lib/plans/config.ts::PLAN_FEATURES.pro.voice` e o
   `plans.features.voice` no banco eram `true` para o Pro também — o
   código real dava Voice AI pro Pro, mas a lista de benefícios original do
   usuário só menciona Voice no Business. Decidido corrigir o entitlement
   (não só a tabela de marketing) para bater com o que o usuário
   especificou — sem clientes ativos, mudança seguramente aplicável agora
   (migration `0247`).
4. Documentado, não inventado: "WhatsApp 1 número (Starter) / múltiplos
   números (Business)" é oferta comercial na tabela — o código não trava
   por quantidade de conexões WhatsApp hoje. Não fingir que já é enforced.

Reason: o usuário está ativamente corrigindo a estrutura comercial peça
por peça; a tabela de benefícios teria ficado tecnicamente correta mas
comercialmente errada (venderia Voice no Pro) se eu só tivesse mudado a
copy sem tocar no entitlement real — pior tipo de inconsistência (a app
concede um recurso que o marketing e o negócio não pretendiam vender
naquele tier).

Impact: `lib/billing/plan-features.ts` reescrito. `lib/plans/config.ts`
(`PLAN_FEATURES.pro.voice: false`) e migration `0247` (mesmo campo no
banco). `components/features/voice/VoicePaywall.tsx` copy corrigida.
`docs/PRICING_ARCHITECTURE.md` documenta a mudança e a pendência de
WhatsApp.

## 2026-09-13 — Fase 7: bug crítico encontrado nos testes (consume_ai_credits quebrado desde a Fase 2/3)

Context: pedido do usuário pra continuar a Fase 7 (testes críticos de
billing/credits — concessão mensal, consumo, compra, refund, saldo
insuficiente, concorrência, idempotência, isolamento entre workspaces).
Como o projeto não tem suíte de integração (só Vitest unitário), optei por
exercitar as funções SQL reais via Supabase MCP contra uma conta
descartável (criada e apagada ao final), já que mockar `SELECT...FOR
UPDATE`/idempotência em Vitest seria fingir uma garantia que só existe no
banco de verdade.

**O primeiro cenário testado (consumo normal, saldo suficiente) falhou
imediatamente** com `42703: column "lead_id" does not exist` — a migration
`0244` (Fase 2/3) tinha reescrito `consume_ai_credits()`/`refund_ai_credits()`
com um INSERT referenciando `lead_id`, mas o nome real da coluna em
`ai_credit_transactions` (desde a migration `0073`, rename
leads→contatos) é `contato_id`. Isso significa que **todo consumo
bem-sucedido de Althos Credits esteve quebrado** desde o push da Fase 2/3
(`ed0a9ad`) até agora — não só um caso hipotético de teste. Os
smoke-tests anteriores (nas Fases 2/3 e 4) só tinham testado o caminho de
saldo insuficiente da conta usada (que retorna ANTES do INSERT
problemático), então o bug não tinha sido pego.

Decision: corrigir imediatamente (migration `0248`) em vez de só
documentar e seguir — é um bug de produção real, não uma melhoria
adiável. Também adicionado `transaction_id` ao retorno de
`consume_ai_credits` (faltava desde a Fase 2/3 — sem ele, `refund_ai_credits`
nunca poderia ser chamado por um caller que só tivesse o resultado do
consumo). Depois do fix, repeti os 6 cenários de teste (consumo, retry
idempotente, refund, double-refund, saldo insuficiente, isolamento) tanto
para AI credits quanto pra Voice credits — todos passaram. `voice_credits`
nunca teve esse bug de coluna (não usa `lead_id`/`contato_id`), só o AI
precisou do fix.

Reason: um bug que quebra a funcionalidade central de um sistema de
billing (débito nunca acontece) é sempre prioridade máxima assim que
encontrado — a Fase 7 existe exatamente pra pegar esse tipo de coisa antes
de afetar mais gente (mesmo sem clientes ativos, o Agente IA/Insights/etc.
já podem estar em uso interno ou por quem está testando a plataforma).

Impact: `supabase/migrations/0248_fix_credit_functions_contato_id_column.sql`
aplicada. `lib/credits/engine.ts::consumeCredits()` ganhou `transactionId`
no tipo de retorno de sucesso. Testado e confirmado via Supabase MCP
(conta descartável, sem afetar dados reais) — ver `.ai/CURRENT_TASK.md`
§ Completed (Fase 7) pra lista completa dos 6 cenários validados, e o que
ficou explicitamente NÃO testado (concorrência real com múltiplas
conexões — o Supabase MCP executa uma query por vez; código revisado usa
`SELECT...FOR UPDATE`, padrão correto, mas não validado sob carga real).

## 2026-09-13 — Fases 8/9/10: harness atualizado + verificação final

Context: usuário pediu pra executar as Fases 8 (harness), 9 (handoff) e 10
(verificação) em sequência, sem pedir nova autorização entre elas.

Decision:
1. **Fase 8**: alimentar de volta no harness as lições reais desta sessão
   em vez de só resumir o que foi feito. `.harness/agents/database.md`
   ganhou 2 itens de processo obrigatório: (a) nunca escrever
   INSERT/UPDATE referenciando nome de coluna "de memória" — confirmar
   via `information_schema.columns` primeiro (o bug real `lead_id`/
   `contato_id` da Fase 7); (b) `CREATE OR REPLACE FUNCTION` que muda a
   lista de parâmetros cria função órfã em vez de substituir — sempre
   `DROP FUNCTION` explícito antes + confirmar via `pg_proc`; (c) smoke-test
   de função de billing precisa exercitar o caminho de SUCESSO, não só
   erro. `.harness/invariants.md` ganhou uma seção "Billing / Credits"
   nova. `CLAUDE.md` atualizado (contador de migrations, referências aos
   3 docs novos, aviso sobre `CREATE OR REPLACE FUNCTION`). Documentos de
   pricing obsoletos (`docs/novo-modelo-de-precos.md`,
   `docs/plano-precos/03-tabela-final-de-planos.md`) marcados como
   supersedidos no topo do próprio arquivo — NÃO apagados (histórico).
2. **Fase 9**: feita incrementalmente a cada fase anterior (cada commit
   desta sessão já saiu com `.ai/HANDOFF.md`/`CURRENT_TASK.md`/
   `DECISIONS.md` atualizados) — Fase 9 aqui só consolida, não é um
   trabalho novo.
3. **Fase 10**: rodei lint/typecheck/test/build de verdade (não assumi
   que "deveria passar"). `npm run lint` sozinho estourava a memória
   default do Node nesta máquina — precisou de
   `NODE_OPTIONS=--max-old-space-size=8192` (limitação de ambiente, não
   do código). Encontrou 14 erros reais: 2 eram meus (dois arquivos que
   ultrapassaram o limite de 350 linhas do lint depois das mudanças desta
   sessão — `lib/plans/config.ts`, `app/app/[orgSlug]/assinatura/page.tsx`),
   corrigidos por extração (`lib/plans/seats.ts`, `lib/plans/credit-pricing.ts`,
   `assinatura/UsageRow.tsx`); os outros 12 são do trabalho de uma sessão
   paralela rodando no mesmo working directory — confirmados fora de
   escopo, NÃO tocados (risco de conflitar com trabalho em andamento).
   `npm run build` passou limpo.
4. **Erro de auditoria próprio, corrigido**: eu tinha afirmado (Fases 5/6)
   que "a pricing page pública não existe neste repo". Isso estava
   ERRADO — `app/(public)/planos/page.tsx` existe; minha varredura
   anterior procurou por "pricing"/"preco" no nome do arquivo e não achou
   "planos". Boa notícia: ela lê `PUBLIC_PLANS` de
   `lib/billing/plans-data.ts` sem número hardcoded próprio, então já
   herdou a correção de preço da Fase 5 automaticamente — nenhuma ação
   necessária, só corrigi o registro pra não propagar a informação errada
   pra uma sessão futura.

Reason: o pedido explícito era "executar em sequência sem pedir nova
autorização" — mas isso não significa pular verificação real. Rodar
lint/build de verdade (em vez de assumir que passariam) pegou 2
regressões reais próprias antes que virassem problema, e corrigir o
próprio erro de auditoria (pricing page) evita que uma sessão futura
herde uma premissa falsa.

Impact: `.harness/invariants.md`, `.harness/agents/database.md`,
`CLAUDE.md` atualizados. `lib/plans/seats.ts`, `lib/plans/credit-pricing.ts`,
`app/app/[orgSlug]/assinatura/UsageRow.tsx` (novos, extraídos por limite
de linhas). `docs/novo-modelo-de-precos.md`,
`docs/plano-precos/03-tabela-final-de-planos.md` marcados supersedidos.
Build de produção validado (`npm run build`, PASS).

## 2026-09-13 — Recalibração 5x do custo por ação de IA (unit economics do Business)

Context: usuário perguntou quanto custa uma resposta de Agente IA no
WhatsApp e se o custo por função tinha mudado nesta sessão. Ao responder,
calculei que a franquia do Business (7.500 créditos, 1 crédito/resposta,
~US$0,01 de custo real de token por resposta) representava até
**US$75/mês de custo real por conta** — o usuário confirmou que isso
excede a margem que faz sentido e pediu correção: o custo real máximo
deve ser **no máximo US$15/mês (R$75)** por conta Business.

Decision: o usuário foi explícito sobre a abordagem — manter a franquia
de créditos FIXA (7.500 continua sendo o número vendido/exibido) e
multiplicar o CUSTO de cada ação por um fator 5, uniformemente, para
TODAS as ações que consomem Althos Credits (não só as baratas). Onde uma
ação custava 1 crédito, agora custa 5.

Reason: multiplicar o consumo por 5 em vez de reduzir a franquia por 5
tem o MESMO efeito em unit economics (7.500 créditos ÷ 5x custo = mesmo
teto real de gasto que 1.500 créditos ÷ 1x custo), mas preserva o número
"7.500 Althos Credits" que já foi comunicado/vendido como benefício do
plano — mudar esse número seria pior comercialmente do que ajustar o
custo interno de cada ação (que o cliente não vê o valor absoluto, só o
saldo restante).

Impact: migration `0249` multiplicou por 5 todos os valores em
`ai_action_cost_catalog` (fonte viva, editável em
`/super-admin/ai-credits`): `ai_attendant_reply`/`instagram_ai_reply`/
`qualify_lead`/`lead_scoring`/`property_matching` 1→5,
`ai_insights_query` 9→45, `financial_ai_chat` 7→35, `generate_proposal`
8→40, `ocr_extract` 5→25, `roteirista_generate` 4→20.
`lib/plans/credit-pricing.ts::AI_CREDIT_COST` (fallback estático)
atualizado com a mesma proporção ×5 sobre os valores que já tinha (não
necessariamente os mesmos números do catálogo vivo — os dois já
divergiam antes desta mudança; a proporção interna de cada um foi
preservada). Franquia mensal por plano (`PLAN_META.aiCreditsMonthly`:
500/2.500/7.500) **não foi alterada** — só o custo por ação. Validado via
smoke-test (conta descartável, plano Business): `ai_attendant_reply`
debitou exatamente 5 créditos (7500→7495), confirmando que o mesmo teto
agora rende 1.500 respostas em vez de 7.500. `docs/ALTHOS_CREDITS.md`
documenta a tabela completa de antes/depois e o raciocínio de unit
economics.
