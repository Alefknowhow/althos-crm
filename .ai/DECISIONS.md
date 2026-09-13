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
