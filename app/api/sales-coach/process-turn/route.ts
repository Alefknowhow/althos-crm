import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { consumeCredits } from '@/lib/credits/engine'
import { resolveAnthropicEngine } from '@/lib/ai/api-key'
import { updateSalesContext } from '@/lib/sales-coach/context-engine'
import { extractSalesEvents } from '@/lib/sales-coach/event-engine'
import { generateNextBestAction, type NextBestAction } from '@/lib/sales-coach/next-best-action'
import { emptySalesContext, type SalesContext, type SalesEvent, type TranscriptSegmentInput } from '@/lib/sales-coach/types'
import { emptySalesCoachKnowledge, formatKnowledgeForPrompt } from '@/lib/sales-coach/knowledge'

// Fatia 5 — liga as engines puras (context/event/next-best-action) ao
// stream real de transcrição. O browser acumula os trechos finais
// (committed) que já está recebendo via WebSocket do Railway e manda um
// "turno" aqui de tempos em tempos (nunca por partial) — ver
// SalesCoachLiveSpike.tsx. Debita crédito ANTES de cada chamada de IA,
// nunca depois (regra do CLAUDE.md).
export const maxDuration = 30

interface ProcessTurnBody {
  orgSlug: string
  sessionId: string
  newSegments: TranscriptSegmentInput[]
  previousContext: SalesContext
  existingEvents: SalesEvent[]
  wantNextBestAction: boolean
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ProcessTurnBody | null
  if (!body?.orgSlug || !body.sessionId || !Array.isArray(body.newSegments)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(body.orgSlug)

  const hasFeature = await checkFeatureAccessByOrgSlug(body.orgSlug, 'sales_coach')
  if (!hasFeature) {
    return NextResponse.json({ error: 'IA Sales Coach não está disponível no seu plano.' }, { status: 403 })
  }
  const permission = await checkMemberPermission(org.id, user.id, 'sales_coach')
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 })
  }

  const accountId = (org as { account_id?: string | null }).account_id ?? null
  if (!accountId) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 500 })
  }

  const previousContext = { ...emptySalesContext(), ...body.previousContext }
  const newSegments = body.newSegments.filter((s) => s.text && s.text.trim().length > 0)

  if (newSegments.length === 0) {
    return NextResponse.json({ context: previousContext, newEvents: [], nextBestAction: null })
  }

  const engine = await resolveAnthropicEngine()
  if (!engine.apiKey) {
    return NextResponse.json({ error: 'IA temporariamente indisponível.' }, { status: 503 })
  }

  const supabase = createClient()
  const { data: knowledgeRow } = await supabase
    .from('sales_coach_knowledge')
    .select('company_pitch, products, differentiators, competitors, objections')
    .eq('organization_id', org.id)
    .maybeSingle()
  const knowledge = knowledgeRow
    ? {
        companyPitch: knowledgeRow.company_pitch ?? '',
        products: knowledgeRow.products ?? '',
        differentiators: knowledgeRow.differentiators ?? '',
        competitors: knowledgeRow.competitors ?? '',
        objections: Array.isArray(knowledgeRow.objections) ? knowledgeRow.objections : [],
      }
    : emptySalesCoachKnowledge()
  const orgKnowledge = formatKnowledgeForPrompt(knowledge)

  // Context + Event extraction — modelo barato (haiku), 1 débito por turno.
  const turnCredit = await consumeCredits({
    accountId,
    action: 'sales_coach_turn',
    module: 'sales_coach',
    credits: 3,
    provider: 'anthropic',
    userId: user.id,
  })
  if (!turnCredit.success) {
    return NextResponse.json({ error: 'Créditos de IA insuficientes.', code: 'insufficient_credits' }, { status: 402 })
  }

  const updatedContext = await updateSalesContext({ previousContext, newSegments, engine, orgKnowledge })
  const newEvents = await extractSalesEvents({
    context: updatedContext,
    newSegments,
    existingEvents: body.existingEvents || [],
    engine,
    orgKnowledge,
  })

  let nextBestAction: NextBestAction | null = null
  if (body.wantNextBestAction) {
    const nbaCredit = await consumeCredits({
      accountId,
      action: 'sales_coach_next_best_action',
      module: 'sales_coach',
      credits: 10,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      userId: user.id,
    })
    if (nbaCredit.success) {
      nextBestAction = await generateNextBestAction({ context: updatedContext, engine, orgKnowledge })
    }
  }

  // Persistência — best-effort, não bloqueia a resposta ao vendedor.
  const admin = createAdminClient()
  void admin
    .from('sales_coach_context')
    .upsert(
      { organization_id: org.id, session_id: body.sessionId, data: updatedContext, updated_at: new Date().toISOString() },
      { onConflict: 'session_id' },
    )
  if (newEvents.length > 0) {
    void admin.from('sales_coach_events').insert(
      newEvents.map((e) => ({
        organization_id: org.id,
        session_id: body.sessionId,
        type: e.type,
        summary: e.summary,
        confidence: e.confidence,
        importance: e.importance,
        suggestion: e.suggestion,
      })),
    )
  }

  return NextResponse.json({ context: updatedContext, newEvents, nextBestAction })
}
