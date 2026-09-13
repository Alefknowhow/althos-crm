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
**Generated At**: 2026-09-13T03:28:55.885Z
**Branch**: `master`
**Last Commit**: ed0a9ad feat(billing): Fase 2/3 da nova arquitetura de pricing — repricing + Credit Engine (Althos Credits) (Alef Trentin, 14 minutes ago)

**Recent Commits**:
- ed0a9ad feat(billing): Fase 2/3 da nova arquitetura de pricing — repricing + Credit Engine (Althos Credits)
- 8c6ce4c feat(ia): migracao parcial de OCR de visao para o switch central (so imagem)
- 3ae5a70 feat(ia): switch central Claude/DeepSeek via super-admin + remove seletor por org
- 2a062fe fix(contatos): alinha campo de indicacao com os demais dropdowns
- 52a867b feat(contatos): origem do lead editavel + indicacao com quem indicou
- 41ec4ef feat(pipeline): rastreamento Google Ads por pipeline (client-side)
- d761178 feat(pipeline): Pixel/CAPI da Meta vira config por pipeline, nao por conta
- 72068f8 fix(contatos): simplifica card da lista — remove telefone e data de última atividade
- 95ca1db feat(mobile): varredura final 2 — tabelas sem scroll contido
- 9b9b230 feat(mobile): M22-M24 (Ofertas, Catálogo, Embarques) — scroll e toque

**Staged Files** (0):
_(nenhum)_

**Unstaged Changes** (8):
- M .ai/CURRENT_TASK.md
- M .ai/DECISIONS.md
- M .ai/HANDOFF.md
- M app/api/webhooks/voice/twilio/status/route.ts
- M docs/BILLING.md
- M lib/inngest/voice-calls.ts
- M lib/inngest/voice-sms.ts
- M lib/voice/credits.ts

**Untracked Files** (3):
- .claude/
- supabase/migrations/0245_voice_credits_idempotency.sql
- tests/unit/voice-credits.test.ts

**Staged Diff Summary**:
```
_(nenhuma alteração)_
```

**Unstaged Diff Summary**:
```
.ai/CURRENT_TASK.md                           | 56 +++++++++++++++--
 .ai/DECISIONS.md                              | 41 +++++++++++++
 .ai/HANDOFF.md                                | 86 +++++++++++++++++----------
 app/api/webhooks/voice/twilio/status/route.ts |  6 +-
 docs/BILLING.md                               | 13 ++--
 lib/inngest/voice-calls.ts                    | 12 +++-
 lib/inngest/voice-sms.ts                      | 39 ++++++++++--
 lib/voice/credits.ts                          | 48 +++++++++++++--
 8 files changed, 249 insertions(+), 52 deletions(-)
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

**Isto é Fase 2/3/4 de 10 do pedido original — não está concluído.** Fases
5 (Billing Center UI, pricing page, admin interno), 6 (estratégia de
migração ativa, se necessária além do audit trail), 7 (testes de
concorrência real), 8 (auditoria completa do harness) seguem pendentes —
ver `.ai/CURRENT_TASK.md` § Pending para a lista detalhada.

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

### Recommended Next Steps
1. Fase 5: Billing Center UI — bloco de usuários incluídos/adicionais
   (`computeSeatCost` já existe, falta consumir na UI), histórico de
   Althos Credits com filtros, alertas de consumo, upgrade contextual.
2. Fase 4 (resíduo, opcional): `voice_minutes` com breakdown de custo por
   componente (telefonia/STT/LLM/TTS) — hoje só custo total é registrado.
3. Rodar `npm run build` antes do próximo deploy (não rodado nesta leva).
4. Auditoria dos pontos de `if (plan === ...)` espalhados no código legado
   (não tocados nesta leva) — candidato a uma tarefa própria, separada.

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
