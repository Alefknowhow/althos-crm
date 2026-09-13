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

### Multiplicador por modelo

`MODEL_CREDIT_MULTIPLIER` (`lib/plans/config.ts`) — Althos paga o token, então modelos mais caros consomem mais créditos por ação (Haiku 1× · Sonnet/GPT-4o 3× · Opus 5×). Isso preserva o custo por crédito ~constante independente de qual modelo respondeu.

## O que Althos Credits NÃO é

- **WhatsApp**: enviar/receber mensagens normais nunca consome créditos. Só quando a IA responde (Agente IA) é que há débito — e o débito é do módulo `ai_attendant`, não do "envio da mensagem" em si.
- **Voice AI**: minutos de chamada são billing de uso próprio (`voice_credits`/`lib/voice/credits.ts`) — Voice não debita de `ai_credits`. Isso já era assim antes desta mudança; mantido deliberadamente (seção 12 do pedido original).
- **SMS**: mesma lógica — usage próprio, fora do Credit Engine.

## Pendências conhecidas (não implementadas nesta leva)

- Ledger explícito de `monthly_grant` (hoje a franquia mensal é criada implicitamente no primeiro consumo do período, sem uma transação auditável própria).
- Tela de histórico de consumo com filtro por usuário/módulo/período (Billing Center — Fase 5).
- Alertas de 50/75/90/100% de consumo.
- Migração de `voice_credits`/`email_credits` para o mesmo padrão de idempotência do Credit Engine (hoje eles têm ledgers próprios, sem o `idempotency_key`/`refund_of` que `ai_credit_transactions` ganhou nesta migration).
