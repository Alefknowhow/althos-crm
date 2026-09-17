import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccess } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import {
  getSalesCoachRealtimeWsUrl,
  hasSalesCoachRealtimeSecret,
  signSalesCoachRealtimeToken,
} from '@/lib/sales-coach/realtime-token'

/**
 * Emite o token de curta duração + a URL do serviço realtime (Railway) que
 * o browser usa para abrir `wss://.../session?token=...` e começar a
 * transcrição ao vivo do IA Sales Coach. Nunca expõe ELEVENLABS_API_KEY nem
 * SUPABASE_SERVICE_ROLE_KEY ao client — só esse token escopado a UMA sessão
 * recém-criada (ver `.harness/tasks/active/ia-sales-coach.md`, fatia 3).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const orgSlug = body?.orgSlug as string | undefined
  const contatoId = (body?.contatoId as string | undefined) || null
  const negocioId = (body?.negocioId as string | undefined) || null

  if (!orgSlug) {
    return NextResponse.json({ error: 'orgSlug é obrigatório.' }, { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const accountId = (org as { account_id?: string | null }).account_id ?? null
  const hasFeature = accountId ? await checkFeatureAccess(accountId, 'sales_coach') : false
  if (!hasFeature) {
    return NextResponse.json(
      { error: 'IA Sales Coach não está disponível no seu plano.', code: 'feature_locked' },
      { status: 403 },
    )
  }

  const permission = await checkMemberPermission(org.id, user.id, 'sales_coach')
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 })
  }

  if (!hasSalesCoachRealtimeSecret() || !getSalesCoachRealtimeWsUrl()) {
    return NextResponse.json(
      { error: 'Serviço de transcrição em tempo real não está configurado neste ambiente.' },
      { status: 503 },
    )
  }

  const supabase = createClient()
  const { data: session, error } = await supabase
    .from('sales_coach_sessions')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      contato_id: contatoId,
      negocio_id: negocioId,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Não foi possível iniciar a sessão do Sales Coach.' }, { status: 500 })
  }

  const token = signSalesCoachRealtimeToken({
    sessionId: session.id,
    organizationId: org.id,
    userId: user.id,
  })

  return NextResponse.json({
    sessionId: session.id,
    token,
    wsUrl: `${getSalesCoachRealtimeWsUrl()}/session?token=${encodeURIComponent(token)}`,
  })
}
