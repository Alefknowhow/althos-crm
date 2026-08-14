/**
 * Processa DMs/comentários do Instagram em background. O webhook
 * (app/api/webhooks/instagram/route.ts) só valida a assinatura e enfileira
 * um evento por interação — quem manda a resposta (IA ou fixa) pra Meta é
 * esta function, fora do ciclo de resposta que a Meta espera rápido.
 *
 * Evita o timeout/retry-storm que existia antes: `processInboundInteraction`
 * pode chamar a Anthropic (resposta com IA) + a Graph API (enviar a
 * resposta) de forma síncrona internamente, o que não tem lugar dentro do
 * handler do webhook. Idempotência já é garantida dentro de
 * processInboundInteraction (de-dupe por mid/commentId), então um retry do
 * Inngest é seguro.
 */

import { inngest } from './client'
import { processInboundInteraction, type InboundInteraction } from '@/lib/social/engine'

export const processInstagramInboundFn = inngest.createFunction(
  {
    id:       'process-instagram-inbound',
    name:     'Instagram: processa DM/comentário recebido',
    retries:  2,
    triggers: [{ event: 'instagram/inbound.received' }],
  },
  async ({ event }: { event: { data: InboundInteraction } }) => {
    await processInboundInteraction(event.data)
    return { ok: true }
  },
)
