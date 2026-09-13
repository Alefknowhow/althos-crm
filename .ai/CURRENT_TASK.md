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
IN PROGRESS (Fase 3 de 10 concluída — schema+engine; Fases 4-10 pendentes)

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

## In Progress
Nada em edição no momento — este bloco (Fase 2/3) está pronto para commit.

## Pending
- **Fase 4** — conectar Voice/SMS/WhatsApp ao metering (Voice/SMS já têm
  ledger PRÓPRIO, mas sem o padrão de idempotência/refund que o Credit
  Engine ganhou; `voice_minutes` com breakdown de custo STT/LLM/TTS
  descrito no pedido não existe como tabela; `sms_usage` não existe).
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
