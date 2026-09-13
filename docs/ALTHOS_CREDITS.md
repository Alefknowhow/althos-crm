# Althos Credits

> Unidade comercial de consumo de recursos de IA no Althos CRM.
> Ver também [PRICING_ARCHITECTURE.md](./PRICING_ARCHITECTURE.md) e [BILLING.md](./BILLING.md).

## O que é

**Althos Credits != tokens.** O cliente nunca vê "tokens de IA", "Anthropic", "Gemini" ou "OpenAI" — só vê um número: quantos créditos tem, quantos usou, quantos restam. Internamente, cada consumo continua registrando `provider`/`model`/`internal_cost_cents` para permitir unit economics (margem por operação, por plano, por modelo), mas isso nunca é exposto na UI do cliente.

Usado por: Agente IA (WhatsApp/Instagram), resumo de conversa, reescrita, classificação de lead (lead scoring), extração de dados/OCR, Insights com IA, geração de propostas, roteirista de viagem, chat do Financeiro — qualquer recurso que chama um LLM.

**Não usado por**: WhatsApp/Meta (mensagens normais), Voice AI (minutos de chamada), SMS. Esses três têm billing de uso próprio — ver seção "O que Althos Credits NÃO é" abaixo.

## Arquitetura (Credit Engine)

Camada central: [`lib/credits/engine.ts`](../lib/credits/engine.ts). Nenhum módulo deve chamar as RPCs SQL diretamente nem reimplementar lógica de débito.

```
consumeCredits({ accountId, action, module, model?, internalCostCents?, idempotencyKey? })
  -> RPC consume_ai_credits (SECURITY DEFINER, SELECT...FOR UPDATE, idempotente)
  -> debita ai_credits (saldo do período) + insere linha em ai_credit_transactions (ledger)

refundCredits(transactionId, reason)
  -> RPC refund_ai_credits (idempotente por transação — nunca estorna 2x)

getCreditPackagesCatalog()
  -> lê a tabela credit_packages (nunca hardcode pacotes/preços em componente)
```

`consumeAiCredits()` (`lib/plans/server.ts`) continua existindo como wrapper fino sobre `consumeCredits()` — mantém compatibilidade com os ~30 call sites de IA já existentes sem exigir reescrita imediata de todos eles. Novo código deve preferir `consumeCredits()` diretamente (expõe `module`, `idempotencyKey`, `internalCostCents`, que o wrapper legado não expõe).

### Tabelas (schema real — nomes não foram renomeados)

| Nome comercial | Tabela real | Observação |
|---|---|---|
| Saldo de Althos Credits (por conta, por mês) | `ai_credits` | `credits_included` (franquia do plano) + `credits_purchased` (pacotes comprados) − `credits_used` |
| Ledger de Althos Credits | `ai_credit_transactions` | Ver "Tipos de movimentação" abaixo |
| Catálogo de pacotes avulsos | `credit_packages` | id/credits/price_cents/sort_order/is_active — editável sem deploy |

Decisão explícita (migration `0244`): **não renomear as tabelas**. Renomear uma tabela de billing em produção é uma operação arriscada e sem ganho real (o nome comercial já vive isolado na camada de UI/docs). Se isso incomodar uma auditoria de código no futuro, criar views (`althos_credits`, `althos_credit_ledger`) é a opção reversível — não fazer DROP/RENAME de tabela viva.

### Tipos de movimentação (`ai_credit_transactions.type`)

- `usage` — consumo por uma ação de IA (substituiu o antigo `consumed`, mantido só como valor legado em linhas antigas).
- `refund` — estorno de um `usage` (1:1, rastreado via `refund_of`).
- `purchased` — compra avulsa de pacote (via Asaas).
- Pendente para a próxima etapa: `monthly_grant` (concessão explícita no início do ciclo — hoje o INSERT ON CONFLICT em `ai_credits` cria a franquia implicitamente, sem uma linha de ledger própria; ver "Pendências").

### Idempotência

Toda chamada originada de um job assíncrono (Inngest) **deve** passar `idempotencyKey`. Convenção: `buildCreditIdempotencyKey(module, action, refId)` → `"${module}:${action}:${refId}"`, onde `refId` é um identificador estável do evento (ex.: `inngest step id`, `message id` do WhatsApp) — o MESMO evento reprocessado (retry) gera a MESMA chave, e a RPC devolve o resultado já registrado em vez de debitar de novo (`idempotent_replay: true`).

### Recalibração 5x do custo por ação (2026-09-13)

A franquia mensal de créditos (Starter 500 / Pro 2.500 / Business 7.500) foi definida na Fase 2/3 sem levar em conta o custo real de token por ação. Ao custo real de ~US$0,01 por resposta de WhatsApp via Agente IA, a franquia do Business (7.500 créditos, 1 crédito/resposta) representava até **US$75/mês de custo real por conta** — margem inviável.

Decisão: **manter a franquia inalterada** (7.500 continua sendo o número que o cliente vê e comprou) e multiplicar o **custo de cada ação em créditos por 5**, uniformemente, em todas as ações — migration `0249`. Onde uma ação custava 1 crédito, agora custa 5. Efeito: o mesmo teto de 7.500 créditos passa a cobrir o equivalente a 1.500 ações "de 1 crédito" (era 7.500), reduzindo o custo real máximo para **~US$15/mês por conta** — a meta definida pelo negócio.

| Ação | Custo antes | Custo depois (5x) |
|---|---:|---:|
| Resposta do Agente IA (WhatsApp/Instagram) | 1 | 5 |
| Qualificação de lead / Lead scoring / Property matching | 1 | 5 |
| Consulta ao Copiloto/Insights | 9 | 45 |
| Chat financeiro IA | 7 | 35 |
| Geração de proposta | 8 | 40 |
| OCR (documento/voucher) | 5 | 25 |
| Roteirista de viagem | 4 | 20 |

A fonte viva desses valores é `ai_action_cost_catalog` (editável em `/super-admin/ai-credits`, sem deploy) — os números acima já refletem a atualização. `lib/plans/credit-pricing.ts::AI_CREDIT_COST` (fallback estático, usado só se o catálogo estiver indisponível) foi atualizado no mesmo commit para não divergir logo após a mudança.

**Multiplicador de modelo continua se aplicando por cima** — ex.: uma resposta do Agente IA com Claude Sonnet (3×) custaria `5 × 3 = 15` créditos, não mais `1 × 3 = 3`.

### Multiplicador por modelo

`MODEL_CREDIT_MULTIPLIER` (`lib/plans/config.ts`) — Althos paga o token, então modelos mais caros consomem mais créditos por ação (Haiku 1× · Sonnet/GPT-4o 3× · Opus 5×). Isso preserva o custo por crédito ~constante independente de qual modelo respondeu.

## O que Althos Credits NÃO é

- **WhatsApp**: enviar/receber mensagens normais nunca consome créditos. Só quando a IA responde (Agente IA) é que há débito — e o débito é do módulo `ai_attendant`, não do "envio da mensagem" em si.
- **Voice AI**: minutos de chamada são billing de uso próprio (`voice_credits`/`lib/voice/credits.ts`) — Voice não debita de `ai_credits`. Isso já era assim antes desta mudança; mantido deliberadamente (seção 12 do pedido original).
- **SMS**: mesma lógica — usage próprio, fora do Credit Engine.

## Bug crítico encontrado e corrigido na Fase 7 (testes) — leia antes de tocar em `consume_ai_credits`/`refund_ai_credits`

A migration `0244` (Fase 2/3) reescreveu `consume_ai_credits()`/`refund_ai_credits()` com um `INSERT` que referenciava a coluna **`lead_id`** em `ai_credit_transactions` — mas o nome real da coluna (desde a migration `0073`, rename `leads`→`contatos`) é **`contato_id`**. Qualquer consumo/estorno que passasse do check de saldo (ou seja, **todo consumo bem-sucedido**, não só o caminho de saldo insuficiente) lançava o erro `42703: column "lead_id" does not exist` em vez de debitar.

**Impacto real**: entre o push da Fase 2/3 (commit `ed0a9ad`) e a correção (migration `0248`), toda chamada de sucesso a `consumeAiCredits()`/`consumeCredits()` — Agente IA, lead scoring, Insights, extração de documentos, roteirista — falhava silenciosamente (o erro era capturado e logado, retornando `{success:false, error:'rpc_error'}`, então a feature de IA correspondente ficava indisponível para o usuário, sem crash do app, mas também sem débito nem entrega do recurso).

**Por que os smoke-tests anteriores não pegaram isso**: os testes feitos ao aplicar as migrations `0244`/`0245` só exercitaram o caminho de **saldo insuficiente** (`available: 0` para a conta de teste usada), que retorna *antes* do `INSERT` problemático. Só ao rodar um cenário de consumo **bem-sucedido de verdade** na Fase 7 (testes de billing) é que o bug apareceu.

Corrigido na migration `0248` — trocado `lead_id` por `contato_id` nos dois `INSERT`s, mais o retorno de `transaction_id` que faltava em `consume_ai_credits` (sem ele, não havia como chamar `refund_ai_credits` depois de um consumo). `lib/credits/engine.ts::consumeCredits()` atualizado para expor `transactionId` no resultado, espelhando o que `consumeVoiceCredits()` já fazia.

**Verificado via smoke-test manual (Supabase MCP, conta descartável, apagada ao final)**: consumo normal, retry idempotente (não duplica débito), refund, refund duplicado (rejeitado), saldo insuficiente, isolamento entre contas — todos os 6 cenários passaram após a correção.

## Pendências conhecidas (não implementadas nesta leva)

- Ledger explícito de `monthly_grant` (hoje a franquia mensal é criada implicitamente no primeiro consumo do período, sem uma transação auditável própria).
- Tela de histórico de consumo com filtro por usuário/módulo/período (Billing Center — Fase 5).
- Alertas de 50/75/90/100% de consumo.
- Migração de `voice_credits`/`email_credits` para o mesmo padrão de idempotência do Credit Engine (hoje eles têm ledgers próprios, sem o `idempotency_key`/`refund_of` que `ai_credit_transactions` ganhou nesta migration).
