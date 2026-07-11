import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

/**
 * Tracking da proposta pública (sem auth — chamado pelo link do cliente).
 *
 * - proposal.viewed      → 1º load por sessão; promove status sent → viewed
 * - proposal.cta_clicked → clique nos CTAs de WhatsApp ({ cta: reservar|duvidas })
 *
 * Eventos entram no pipeline Inngest existente (lead scoring / CAPI).
 */

const BodySchema = z.object({
  token: z.string().min(8).max(64),
  type: z.enum(['viewed', 'cta_clicked']),
  cta: z.enum(['reservar', 'duvidas']).optional(),
})

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Payload inválido', code: 'bad_request' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: q } = await supabase
    .from('travel_proposals')
    .select('id, organization_id, contato_id, status')
    .eq('public_token', body.token)
    .maybeSingle()

  if (!q) return NextResponse.json({ error: 'Não encontrada', code: 'not_found' }, { status: 404 })

  if (body.type === 'viewed' && q.status === 'sent') {
    await supabase.from('travel_proposals').update({ status: 'viewed' }).eq('id', q.id)
  }

  try {
    await inngest.send({
      name: body.type === 'viewed' ? 'proposal.viewed' : 'proposal.cta_clicked',
      data: {
        orgId: q.organization_id,
        proposalId: q.id,
        contatoId: q.contato_id,
        ...(body.type === 'cta_clicked' ? { cta: body.cta || 'reservar' } : {}),
      },
    })
  } catch {
    // Tracking é best-effort: nunca quebra a visualização do cliente.
  }

  return NextResponse.json({ ok: true })
}
