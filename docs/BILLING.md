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

## Billing Center (UI) — estado atual (Fase 5 concluída)

A tela em `/app/[orgSlug]/assinatura` mostra: plano contratado (agora também com o bloco "Usuários" — incluídos/adicionais e custo do assento extra, via `computeSeatCost()`), próxima fatura estimada (plano + assentos extras), Althos Credits (renomeado na copy — antes "Créditos de IA"), Voice Credits, Email Credits (cada um com progress bar + compra + histórico separados por seção), complementos, uso atual, indicações/cupons, histórico de faturas com scroll independente.

**Fonte de preço/franquia**: o bloco de "Usuários"/"Próxima fatura estimada" só aparece se a conta já tem uma linha em `subscriptions` (taxonomia NOVA, por-conta) — contas que só existem na taxonomia legada (`organizations.plan`) não mostram esse bloco, porque não há franquia/preço de assento confiável para calcular ali. Isso é uma consequência direta das duas taxonomias coexistindo (ver `PRICING_ARCHITECTURE.md`), não um bug.

### Compra de Althos Credits agora usa o catálogo central
`purchaseCreditPack(orgSlug, packId)` passou a receber um `packId` (string) e resolver preço via `getCreditPackagesCatalog()` (tabela `credit_packages`) em vez do array `CREDIT_PACKS` (que já estava marcado `@deprecated` desde a Fase 2/3). Único call site (`CreditsPurchaseSection.tsx`) atualizado junto — sem quebra de compatibilidade porque não havia outro consumidor.

### Alertas de consumo (seção 16 do pedido) — implementados para Althos Credits
Limiares 50/75/90/100% no card de Althos Credits do Billing Center (`creditAlert()` em `CreditsPurchaseSection.tsx`) — mensagem inline + barra de progresso em destaque quando acima de 50%. **Não implementado ainda para Voice/Email** (mesma lógica pode ser copiada quando fizer sentido — ficou de fora desta leva pra não inflar o escopo de um pedido já grande).

### CTAs de upgrade contextual (seção 17) — já existiam, não precisou construir
Descoberto durante a auditoria: o padrão de "recurso bloqueado + CTA de upgrade" já existe e é usado app-wide (`VoicePaywall.tsx`, mesmo padrão reaproveitado de `app/app/[orgSlug]/relatorios/page.tsx`) — cada página gated (`app/app/[orgSlug]/voice/*`) já renderiza um paywall com o texto "X é um recurso dos planos Y e Z" + botão "Fazer upgrade" em vez de simplesmente esconder a rota. Nenhuma mudança foi necessária aqui.

### Pendências explícitas (próxima etapa)
- Alertas de consumo para Voice/Email (só Althos Credits ganhou nesta leva).
- Reconciliar as duas taxonomias de plano para que TODA conta mostre usuários incluídos/fatura estimada (hoje só contas já migradas para `subscriptions` mostram).
- `monthly_grant` como linha de ledger explícita (pendência desde a Fase 2/3, ainda não feita).

## Admin interno — estado atual

`/super-admin` já tem visão de organizações/contas/assinaturas, mas **não foi auditado nem estendido nesta leva** para os novos campos (MRR por conta, custo estimado de IA vs. receita, margem, ação manual de conceder/corrigir crédito com audit log). Pendência explícita da Fase 5/9.

## Voice e SMS — separação de billing

- **Voice**: `voice_credits`/`voice_credit_transactions` (migration `0228`) — saldo próprio, em cents, não Althos Credits. **Fase 4 (migration `0245`)** trouxe o mesmo rigor do Credit Engine: `consume_voice_credits` agora aceita `idempotencyKey` (protege contra double-charge em retry de `step.run` do Inngest) e existe `refund_voice_credits` (estorno idempotente por transação). `lib/voice/credits.ts` expõe `consumeVoiceCredits()`, `refundVoiceCredits()` e `buildVoiceIdempotencyKey(usageType, refId)`.
  - Estrutura de `voice_minutes` com breakdown de custo por componente (telefonia + STT + LLM + TTS) descrita no pedido original **ainda não existe** como tabela dedicada — hoje `voice_calls`/`voice_credit_transactions` registram custo total (`provider_cost_cents`/`althos_cost_cents`), não a quebra por componente. Pendência real.
- **SMS**: usa o MESMO ledger de Voice (`usageType: 'sms'` em `voice_credit_transactions`) — não existe uma tabela `sms_usage` separada como o pedido original sugeria; decisão pragmática de reaproveitar a arquitetura já auditada como "usage própria, fora do Credit Engine" em vez de duplicar um ledger para uma unidade de negócio pequena. Também recebeu idempotência+refund na Fase 4.
- **WhatsApp**: mensagens normais não têm billing de uso próprio hoje (a Meta cobra o cliente diretamente via conta própria dele na maioria dos casos) — confirmado nesta auditoria (Fase 4) que nenhum ponto do fluxo de ingestão de WhatsApp chama o Credit Engine; só o Agente IA responde.

### Bugs reais corrigidos na Fase 4 (não eram só "falta de rigor" — causavam prejuízo financeiro real)
- `lib/inngest/voice-calls.ts`: se o provider (Twilio) falhasse **depois** da reserva de crédito ser debitada, o cliente perdia o crédito sem receber a chamada — nenhum estorno acontecia. Corrigido: estorna antes de marcar a chamada como falha.
- `lib/inngest/voice-sms.ts`: mesmo problema para SMS — falha do provider depois do débito não estornava. Corrigido, com uma ressalva importante: a função **não relança o erro** depois de estornar (documentado no código) — deixar o Inngest reprocessar o mesmo evento reencontraria a transação já estornada pela idempotency key e devolveria um "replay" que reporta sucesso sem debitar de novo (reenvio de graça). Parar o retry ali é o comportamento seguro; um reenvio real precisa de um novo evento.

## O que foi implementado nesta leva (migration `0244`) vs. o que falta

Ver a seção "Pendências" de [PRICING_ARCHITECTURE.md](./PRICING_ARCHITECTURE.md) e [ALTHOS_CREDITS.md](./ALTHOS_CREDITS.md) — este documento cobre só a parte de pagamento/faturamento, que teve mudança mínima nesta leva (o foco foi Plan Catalog + Credit Engine, não o Billing Center em si).
