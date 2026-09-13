# Development Handoff

Arquivo principal de continuidade entre agentes (Claude Code, Codex, outros)
e entre sessões. Não depende do histórico de chat — tudo que um agente
precisa pra continuar de onde o anterior parou deve estar aqui, em
`CURRENT_TASK.md`, `DECISIONS.md` e `KNOWN_ISSUES.md`.

Duas partes:
- **Automatic Context**: gerada por `npm run handoff`
  (`scripts/generate-handoff.mjs`). Nunca edite esta seção à mão — ela é
  sobrescrita a cada execução do script, dentro dos marcadores HTML
  reservados logo abaixo do título "Automatic Context".
- **Agent Context**: escrita pelo agente. O script nunca toca aqui — só a
  seção Automatic Context é regenerada.

---

## Automatic Context

<!-- AUTO:BEGIN -->
**Generated At**: 2026-09-13T05:05:13.303Z
**Branch**: `master`
**Last Commit**: 44a98fb docs(harness): Fases 8/9/10 — harness atualizado + verificacao final (lint/typecheck/test/build) (Alef Trentin, 12 minutes ago)

**Recent Commits**:
- 44a98fb docs(harness): Fases 8/9/10 — harness atualizado + verificacao final (lint/typecheck/test/build)
- 8e39257 fix(embarques): linha do dia atual em vermelho negrito, sem coluna pintada
- 37cffaa fix(billing): Fase 7 — corrige bug critico que quebrava todo consumo de Althos Credits desde a Fase 2/3
- e3566d9 fix(embarques): dia da linha do tempo alinhado com a linha vertical
- bcabdf7 feat(billing): Fase 6 — lista de beneficios atualizada + Voice vira exclusividade Business
- c0210d4 fix(billing): reconcilia limites de usuarios incluidos/adicionais (sem clientes ativos, autorizado)
- ee697d0 fix(billing): corrige preco de /upgrade — 3a copia hardcoded cobrava R$137 no Starter em producao
- dbb4a4c feat(billing): Fase 5 — Billing Center reflete usuarios incluidos/adicionais e Althos Credits
- 183be32 feat(billing): Fase 4 — Voice/SMS ganham idempotência e refund do Credit Engine
- ed0a9ad feat(billing): Fase 2/3 da nova arquitetura de pricing — repricing + Credit Engine (Althos Credits)

**Staged Files** (0):
_(nenhum)_

**Unstaged Changes** (9):
- M .ai/CURRENT_TASK.md
- M .ai/DECISIONS.md
- M components/features/OneQuestionForm.tsx
- M components/features/PublicFormSchema.ts
- M components/features/formbuilder/FormToolbar.tsx
- M docs/ALTHOS_CREDITS.md
- M lib/plans/credit-pricing.ts
- M package-lock.json
- M package.json

**Untracked Files** (4):
- .claude/
- lib/forms/field-order.ts
- lib/forms/flow-traversal.ts
- supabase/migrations/0249_ai_credit_cost_5x_recalibration.sql

**Staged Diff Summary**:
```
_(nenhuma alteração)_
```

**Unstaged Diff Summary**:
```
.ai/CURRENT_TASK.md                             |  22 +++
 .ai/DECISIONS.md                                |  42 ++++++
 components/features/OneQuestionForm.tsx         |  64 ++++-----
 components/features/PublicFormSchema.ts         |   6 +
 components/features/formbuilder/FormToolbar.tsx |   9 +-
 docs/ALTHOS_CREDITS.md                          |  20 +++
 lib/plans/credit-pricing.ts                     |  35 +++--
 package-lock.json                               | 177 ++++++++++++++++++++++++
 package.json                                    |   1 +
 9 files changed, 332 insertions(+), 44 deletions(-)
```

**Verification Commands Available in This Repo**:
- `npm run lint` (disponível)
- `npx tsc --noEmit` (typecheck — sem script dedicado no package.json, convenção do projeto via AGENTS.md/CI)
- `npm test` (disponível)
- `npm run build` (disponível)
- `bash scripts/verify.sh` (pipeline completo — mesmo do CI)
<!-- AUTO:END -->

---

## Agent Context

### Previous Agent
Claude (Claude Code)

### Recommended Next Agent
Claude | Codex | Human | Other — qualquer um. Prefira Claude/Codex se a
próxima etapa for Fase 4 (Voice/SMS metering) ou Fase 7 (testes de
concorrência real), que exigem ler bastante código antes de editar.

### Task
Implementar nova arquitetura de Pricing/Billing/Althos Credits (pedido de
33 seções do usuário, 2026-09-13). Ver `.ai/CURRENT_TASK.md` (estado
completo e detalhado desta tarefa — este bloco é um resumo) e
`.ai/DECISIONS.md` (2026-09-13).

### Summary
Repricing de planos (Starter R$149/Pro R$299/Business R$599, franquias de
Althos Credits 500/2.500/7.500, usuários incluídos 2/5/10 + preço de
assento extra) direto na tabela central `plans` — decisão de negócio:
migrar todas as contas, sem grandfathering (`subscriptions.legacy_plan_id`/
`repriced_at` guardam o plano anterior só para auditoria). Credit Engine
central criado (`lib/credits/engine.ts`) sobre o `ai_credits`/
`ai_credit_transactions` já existente (não recriado do zero) — ganhou
idempotência (`idempotency_key`, retries de job nunca debitam 2x), refund
(`refund_ai_credits`, 1 estorno por transação), metering de unit economics
(`module`/`provider`/`model`/`internal_cost_cents`) e catálogo central de
pacotes avulsos (`credit_packages`). `consumeAiCredits()` (usado por ~30
call sites de IA) virou wrapper fino sobre o engine — nenhum call site
precisou mudar nesta leva. Documentação nova: `docs/PRICING_ARCHITECTURE.md`,
`docs/ALTHOS_CREDITS.md`, `docs/BILLING.md`.

**Atualização (mesma sessão, continuação): Fase 4 também concluída** —
Voice/SMS ganharam o mesmo padrão de idempotência/refund (migration `0245`)
e 2 bugs financeiros reais foram corrigidos (crédito debitado sem estorno
quando o provider Twilio falhava depois do débito). Ver subseção "Fase 4"
mais abaixo neste documento e `.ai/CURRENT_TASK.md` § Completed.

**Atualização (mesma sessão, continuação): Fase 5 também concluída** —
Billing Center (`/app/[orgSlug]/assinatura`) ganhou bloco de usuários
incluídos/adicionais (`computeSeatCost`), próxima fatura estimada, alerta
de consumo 50/75/90/100% em Althos Credits, renomeação de copy
"Créditos de IA" → "Althos Credits", e a compra de pacotes migrou do array
`@deprecated` para o catálogo central `credit_packages`.

**Atualização (mesma sessão, continuação): preço de `/upgrade` CORRIGIDO**
— usuário pediu explicitamente pra corrigir o risco acima antes de
continuar. Investigação revelou que era pior do que documentado: existia
uma TERCEIRA cópia de preço, em `lib/asaas/client.ts::planValue()`,
hardcoded desde o lançamento (R$137/397/697) — e é ESSE valor, não o
mostrado na tela, que era realmente cobrado na assinatura Asaas
(undercharge real e silencioso). Corrigido: `PLANS` (`lib/billing/plans-data.ts`)
atualizado pros valores repricados; `planValue()` reescrito pra ler dessa
mesma fonte em vez de manter seu próprio mapa. Ver `docs/PRICING_ARCHITECTURE.md`
§ "Risco real encontrado na Fase 5 e CORRIGIDO" e `.ai/DECISIONS.md`
(2026-09-13, segunda entrada do dia). **Pendente**: assinaturas Asaas já
ativas continuam cobrando o valor antigo — ajustar isso é decisão de
negócio (avisar cliente antes), não corrigido aqui.

**Atualização (mesma sessão, continuação): reconciliação de usuários
incluídos/adicionais** — usuário confirmou não haver clientes ativos
("pode prosseguir"). Bug funcional real corrigido: `account_user_limit()`
(bloqueia convite de membro) ignorava `subscriptions.extra_seats` —
migration `0246`. `maxUsers`/`PLAN_LIMITS.users` sincronizados (1/6/20 →
2/5/10) em `lib/billing/plans-data.ts`, `lib/plans/config.ts`,
`actions/billing.ts`. Um incidente de processo (dado de teste
`extra_seats=3` preso numa conta real por engano) foi detectado e
revertido na hora — ver `.ai/DECISIONS.md` (2026-09-13) pra não repetir o
padrão de `UPDATE ... LIMIT 1` sem filtro determinístico.

**Atualização (mesma sessão, continuação): Fase 6 — lista de benefícios +
Voice vira exclusividade Business** — `lib/billing/plan-features.ts`
(tabela de `/upgrade`/`CheckoutModal`) reescrita com os números atuais
(Althos Credits 500/2.500/7.500, usuários 2/5/10 + preço de assento
extra) e a estrutura de benefícios que o usuário definiu originalmente.
Confirmado (não precisou construir): disparos de e-mail de campanha já
consomem Email Credits desde uma sessão anterior. **Mudança de
entitlement real**: Voice AI virou exclusivo do Business (migration
`0247`) — o código dava acesso a Pro também, divergindo da lista de
benefícios original do usuário.

**Atualização (mesma sessão, continuação): Fase 7 — BUG CRÍTICO ENCONTRADO
E CORRIGIDO.** Ao testar cenários reais de billing (Supabase MCP, conta
descartável), o PRIMEIRO teste de consumo bem-sucedido falhou:
`consume_ai_credits()`/`refund_ai_credits()` (migration `0244`) tinham um
INSERT referenciando a coluna errada (`lead_id` em vez de `contato_id`,
nome real desde a migration `0073`). **Todo consumo bem-sucedido de Althos
Credits esteve quebrado desde o push da Fase 2/3 (`ed0a9ad`) até agora** —
os smoke-tests anteriores só tinham testado o caminho de saldo
insuficiente, que não passa pelo INSERT problemático. Corrigido na
migration `0248` (aplicada em produção). Depois do fix, validei 6
cenários (consumo, retry idempotente, refund, double-refund, saldo
insuficiente, isolamento entre contas) tanto pra AI credits quanto Voice
credits — todos passaram. Ver `docs/ALTHOS_CREDITS.md` § "Bug crítico" e
`.ai/DECISIONS.md` (2026-09-13, última entrada) para o relato completo.
**Se você notar qualquer feature de IA "silenciosamente não funcionando"
em relatos de ANTES desta correção, esta é a causa raiz mais provável.**

**Isto é Fase 2/3/4/5/6/7 de 10 do pedido original — não está concluído.**
Fase 6 só cobriu benefícios/entitlements de Voice e usuários — a
reconciliação COMPLETA das duas taxonomias de plano (legada por-org vs.
nova por-conta) ainda não foi feita. Fase 7 não testou concorrência REAL
(múltiplas conexões simultâneas — limitação da ferramenta usada, não do
código; `SELECT...FOR UPDATE` está correto por revisão). Fase 8 (auditoria
completa do harness), 9/10 seguem pendentes — ver `.ai/CURRENT_TASK.md`
§ Pending para a lista detalhada.

### Completed
Ver `.ai/CURRENT_TASK.md` § Completed (lista detalhada com o bug de
parâmetro SQL encontrado e corrigido durante a própria migration — leia
antes de escrever qualquer nova função que toque `consume_ai_credits`).

### Pending
Ver `.ai/CURRENT_TASK.md` § Pending. Resumo: Fases 4-10 do pedido original.

### Current Implementation State
Schema de billing evoluído (migration `0244`, aplicada em produção via
Supabase MCP — não é só um arquivo `.sql` local, já rodou). Credit Engine
funcional e coberto por teste nas partes puras. Nenhuma tela nova de UI
criada nesta leva — o Billing Center existente (`/app/[orgSlug]/assinatura`)
ainda não reflete usuários incluídos/adicionais nem a copy "Althos Credits".

### Important Files
- `supabase/migrations/0244_althos_credits_engine.sql`
- `lib/credits/engine.ts` (Credit Engine — ponto de entrada único para consumo/refund/catálogo)
- `lib/plans/config.ts` (`PLAN_META`, `computeSeatCost`, `CREDIT_PACKS` deprecated)
- `lib/plans/server.ts` (`consumeAiCredits` — wrapper legado sobre o engine)
- `docs/PRICING_ARCHITECTURE.md`, `docs/ALTHOS_CREDITS.md`, `docs/BILLING.md`

### Architectural Decisions
Ver `.ai/DECISIONS.md` — "2026-09-13 — Repricing + Credit Engine (Althos Credits)".

### Database Changes
Migration `0244_althos_credits_engine.sql` (aplicada). Não-destrutiva:
só `ADD COLUMN`/`CREATE TABLE IF NOT EXISTS`/`CREATE OR REPLACE FUNCTION`.
Nenhum `DROP TABLE`/`DROP COLUMN`. Um fixup foi necessário e também já
aplicado (`fix_consume_ai_credits_param_name`) — ver Known Problems.

### API Changes
`consumeAiCredits()` (`lib/plans/server.ts`) — mesma assinatura pública,
implementação interna mudou (agora delega para `consumeCredits()`). Nenhum
call site existente precisou de alteração. Nova API: `lib/credits/engine.ts`
(`consumeCredits`, `refundCredits`, `getCreditPackagesCatalog`,
`buildCreditIdempotencyKey`).

### Environment / Config Changes
Nenhuma variável de ambiente nova.

### Tests Executed
`npx tsc --noEmit`, `npm test` (antes e depois das mudanças).

### Test Results
- `npx tsc --noEmit`: PASS (nenhum erro)
- `npm test`: PASS (173/173, 22 arquivos — 8 testes novos: `computeSeatCost` ×5, `buildCreditIdempotencyKey` ×3)
- `npm run build`: NOT EXECUTED nesta leva (nenhuma tela de UI foi tocada; a mudança é schema+lib — recomendado rodar antes do próximo deploy, junto com a Fase 5)
- Smoke-test manual da RPC via Supabase MCP: chamada posicional de 5 argumentos (compatibilidade retroativa) retornou o shape esperado (`insufficient_credits` para uma conta sem créditos no período, não um erro de função ausente).

### Known Problems
Um bug real foi cometido E corrigido dentro desta mesma sessão (não chegou
a ficar em produção sem correção): o primeiro `CREATE OR REPLACE FUNCTION
consume_ai_credits` usado na migration original usou `p_lead_id` como nome
de parâmetro; o nome real em produção (desde a migration `0073`) é
`p_contato_id`. Como `CREATE OR REPLACE` não pode renomear parâmetros,
Postgres criou uma SEGUNDA função sobrecarregada (órfã — nenhum caller a
alcançava) e a nova versão tinha perdido o bypass de super-admin que a
função real possuía. Corrigido com uma migration de fixup que faz DROP das
duas versões e recria uma única função correta. Se você notar qualquer
`RPC not found` relacionado a `consume_ai_credits`, o primeiro passo é
`select oid::regprocedure from pg_proc where proname='consume_ai_credits'`
— deve haver exatamente 1 resultado.

### Risks
- Repricing já afeta TODAS as contas em produção (mudança de preço/franquia
  ativa desde a aplicação da migration) — se o negócio precisar reverter
  para uma conta específica, os dados de auditoria existem
  (`legacy_plan_id`) mas a lógica de reversão não foi construída.
- `ai_credit_transactions`/`ai_credits` continuam com os nomes de tabela
  antigos (decisão deliberada, ver `docs/ALTHOS_CREDITS.md`) — qualquer
  agente tentado a "limpar" o nome renomeando a tabela deve ler essa seção
  antes.
- Voice/SMS ainda não passam pelo padrão de idempotência do Credit Engine —
  seus próprios ledgers (`voice_credit_transactions` etc.) não ganharam
  `idempotency_key`/`refund_of` nesta leva.

### Do Not Change
- Não renomear/dropar `ai_credits`/`ai_credit_transactions` — decisão
  deliberada documentada em `docs/ALTHOS_CREDITS.md` (risco de migração
  destrutiva sem ganho real; o nome comercial "Althos Credits" já vive
  isolado na camada de UI/docs).
- Não reintroduzir lógica de débito de crédito fora de
  `lib/credits/engine.ts` — é o único ponto de entrada permitido.
- Não remover o bypass de super-admin (`current_user_is_super_admin()`)
  dentro de `consume_ai_credits` — foi perdido uma vez nesta mesma sessão
  (ver Known Problems) e restaurado; removê-lo de novo quebra o acesso
  interno da equipe Althos.
- A separação Automatic Context / Agent Context em `HANDOFF.md`
  (marcadores `AUTO:BEGIN`/`AUTO:END`) — não remova nem escreva os tokens
  literalmente fora da seção real.

### Fase 4 (concluída nesta continuação — Voice/SMS metering)
Migration `0245_voice_credits_idempotency.sql`: `consume_voice_credits`
ganhou `idempotency_key` + retorno de `transaction_id`; nova
`refund_voice_credits`. `lib/voice/credits.ts` expõe `consumeVoiceCredits()`
(agora com `idempotencyKey`), `refundVoiceCredits()`,
`buildVoiceIdempotencyKey()`. **2 bugs financeiros reais corrigidos**: nem
`lib/inngest/voice-calls.ts` nem `lib/inngest/voice-sms.ts` estornavam
crédito quando o provider (Twilio) falhava DEPOIS do débito — cliente
pagava por chamada/SMS que nunca saiu. Corrigido nos dois. Decisão de
design registrada no código de `voice-sms.ts`: o catch NÃO relança o erro
após estornar, porque um retry do Inngest reexecutaria o mesmo step com a
MESMA idempotency key (`event.id`), encontraria a transação já estornada e
devolveria um "replay" que reporta sucesso sem debitar de novo (reenvio de
graça) — ver `docs/BILLING.md` para o raciocínio completo antes de "corrigir"
isso adicionando um `throw` de volta.

SMS deliberadamente NÃO ganhou uma tabela `sms_usage` própria — continua no
ledger de Voice (`usageType: 'sms'`), decisão pragmática documentada em
`docs/BILLING.md`, não uma lacuna esquecida.

### Recommended Next Steps (atualizado — sessão completou Fases 2 a 10)
1. **Fase 6 completa**: reconciliar de vez as duas taxonomias de plano
   (`organizations.plan` legada vs. `accounts`/`subscriptions` nova) — o
   pior sintoma já foi corrigido (preço de `/upgrade` batendo com o
   cobrado de verdade), mas elas ainda coexistem e podem divergir de novo
   se só uma for atualizada no futuro. Candidato a uma tarefa própria,
   grande e arriscada — ler `docs/PRICING_ARCHITECTURE.md` inteiro antes.
2. Testes de concorrência real (múltiplas conexões simultâneas) para
   `consume_ai_credits`/`consume_voice_credits` — não testado nesta
   sessão (limitação da ferramenta usada, não do código). Precisa de um
   script Node com `Promise.all` de várias conexões Postgres reais, ou
   pgbench — infraestrutura de teste que o projeto ainda não tem.
3. `voice_minutes` com breakdown de custo por componente (telefonia/STT/
   LLM/TTS) — hoje só custo total é registrado.
4. Auditoria dos pontos de `if (plan === ...)` espalhados no código
   legado (não tocados nesta sessão) — candidato a uma tarefa própria.
5. Admin interno (super-admin) — MRR, margem de IA por conta, ação manual
   de crédito com audit log — não tocado nesta sessão.

### Verificação final desta sessão (Fase 10)
`npx tsc --noEmit`: PASS. `npm test`: PASS (176/176). `npm run lint`
(precisa de `NODE_OPTIONS=--max-old-space-size=8192` nesta máquina — já
era assim antes): 2 erros próprios corrigidos (arquivos que passaram de
350 linhas — `lib/plans/config.ts` split em `lib/plans/seats.ts` +
`lib/plans/credit-pricing.ts`; `assinatura/page.tsx` split com
`UsageRow.tsx`), 12 erros restantes são do trabalho da sessão paralela,
não tocados. `npm run build`: PASS.

### Continuation Instructions

```
Read AGENTS.md, .ai/PROJECT_CONTEXT.md, .ai/CURRENT_TASK.md and .ai/HANDOFF.md.
Read docs/PRICING_ARCHITECTURE.md, docs/ALTHOS_CREDITS.md and docs/BILLING.md.

Inspect git status and the current diff before making changes.

Continue the current task (Fase 4 or Fase 5 of the 33-section pricing/billing
request) from the Pending and Recommended Next Steps sections in
.ai/CURRENT_TASK.md.

Do not redesign completed architecture (Credit Engine, plan catalog) unless
you identify a concrete issue — read docs/ALTHOS_CREDITS.md's "Do Not
Change" equivalents first.
```
