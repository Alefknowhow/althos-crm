# Billing

> Ver [PRICING_ARCHITECTURE.md](./PRICING_ARCHITECTURE.md) (planos/entitlements) e [ALTHOS_CREDITS.md](./ALTHOS_CREDITS.md) (créditos de IA). Este documento cobre pagamento, assinatura recorrente e a experiência de faturamento.

## Pagamento

Asaas (`lib/asaas/client.ts`) processa dois tipos de cobrança:

1. **Assinatura recorrente** — plano da conta (mensal/semestral/anual).
2. **Compra avulsa (one-off)** — pacotes de créditos (IA/Voice/Email), roteados via `externalReference` no webhook único (`app/api/webhooks/asaas/route.ts`):
   - `credit_pack:<accountId>:<credits>` — Althos Credits (fixo ou avulso, `purchaseCreditPack`/`purchaseCustomCreditPack` em `actions/addons.ts`).
   - `voice_credits:<orgId>:<packId|custom-<cents>>:<timestamp>` — Voice.
   - `email_credits:<orgId>:<packId|custom-<cents>>:<timestamp>` — Email.

`resolvePackCents(packId, packs)` (`lib/asaas/webhook-helpers.ts`) resolve o valor tanto de um pacote fixo quanto de uma referência `custom-<cents>` — compartilhado entre Voice e Email.

## Regra de segurança (billing != confiar no client)

- O frontend **nunca** decide quanto cobrar nem concede crédito diretamente — sempre resolve o preço a partir do catálogo central (`plans`, `credit_packages`) no servidor, nunca de um valor recebido do client.
- Toda mutação de saldo passa por função SQL `SECURITY DEFINER` com `SELECT ... FOR UPDATE` (evita race condition em consumo concorrente) — ver `consume_ai_credits`/`refund_ai_credits` em [ALTHOS_CREDITS.md](./ALTHOS_CREDITS.md).
- Webhook do Asaas é idempotente via `billing_events.dedupe_key` (migration `0224`) — reentrega do mesmo evento não credita duas vezes.

## Billing Center (UI) — estado atual

A tela em `/app/[orgSlug]/assinatura` (redesenhada em setembro/2026, ver commit `c6c8b9c`) já mostra: plano contratado, complementos, uso atual (créditos IA/Voice/Email com progress bar + compra + histórico separados por seção), indicações/cupons, histórico de faturas com scroll independente.

**Não atualizada nesta leva** para refletir a nova filosofia de "usuários incluídos/adicionais" (seção 10/14 do pedido de repricing) nem para consolidar os 3 saldos de crédito sob o nome único "Althos Credits" na UI (hoje a tela já existe mas fala "créditos de IA/Voice/Email" separadamente, o que tecnicamente está correto — Voice/Email não são Althos Credits — mas a chamada explícita da unidade "Althos Credits" para o saldo de IA ainda não foi feita na camada de copy).

### Pendências explícitas (Fase 5, próxima etapa)

- Bloco "Usuários" mostrando `computeSeatCost()` (5 de 5 incluídos / 7 usuários: 5 incluídos + 2 adicionais = R$98/mês).
- "Próxima fatura estimada" somando plano + assentos extras + créditos extras + Voice + SMS.
- Renomear a seção de créditos de IA para "Althos Credits" na copy (a lógica de backend já usa esse conceito; falta só a camada visual).
- CTAs de upgrade contextual ("Automações estão disponíveis a partir do Pro" / "Voice AI está disponível no Business").
- Alertas de consumo (50/75/90/100%).

## Admin interno — estado atual

`/super-admin` já tem visão de organizações/contas/assinaturas, mas **não foi auditado nem estendido nesta leva** para os novos campos (MRR por conta, custo estimado de IA vs. receita, margem, ação manual de conceder/corrigir crédito com audit log). Pendência explícita da Fase 5/9.

## Voice e SMS — separação de billing (parcialmente existente, não unificada nesta leva)

- **Voice**: `voice_credits`/`voice_credit_transactions` (migration `0228`, `lib/voice/credits.ts`) — saldo próprio, em cents, não Althos Credits. Estrutura de `voice_minutes`/breakdown de custo (telefonia + STT + LLM + TTS) descrita no pedido original **não existe ainda** como tabela dedicada — hoje o registro de uso de chamada vive em `voice_calls` sem a quebra de custo por componente. Pendência real, não implementada nesta leva.
- **SMS**: cobrança de SMS ainda não tem uma tabela `sms_usage` dedicada — pendência da próxima etapa.
- **WhatsApp**: mensagens normais não têm billing de uso próprio hoje (a Meta cobra o cliente diretamente via conta própria dele na maioria dos casos) — nenhuma mudança feita aqui; confirmado que o sistema já não debita Althos Credits por mensagem comum, só quando a IA responde.

## O que foi implementado nesta leva (migration `0244`) vs. o que falta

Ver a seção "Pendências" de [PRICING_ARCHITECTURE.md](./PRICING_ARCHITECTURE.md) e [ALTHOS_CREDITS.md](./ALTHOS_CREDITS.md) — este documento cobre só a parte de pagamento/faturamento, que teve mudança mínima nesta leva (o foco foi Plan Catalog + Credit Engine, não o Billing Center em si).
