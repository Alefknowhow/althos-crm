'use server'

/**
 * Althos Voice — Fase 6: analytics. Métricas comerciais e de equipe
 * agregadas a partir de voice_calls/voice_call_insights — sem usar pra
 * julgamento automático de funcionário, só como insight gerencial.
 */
import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

export async function getVoiceAnalytics(orgSlug: string, days = 30) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const org = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()

  const since = new Date(); since.setDate(since.getDate() - days)

  const { data: calls } = await supabase
    .from('voice_calls')
    .select('id, direction, status, human_or_ai, duration_seconds, user_id, ai_agent_id, althos_cost_cents, outcome, created_at')
    .eq('organization_id', org.id)
    .gte('created_at', since.toISOString())

  const rows = calls ?? []
  const answered = rows.filter(c => c.status === 'completed')
  const totalDuration = rows.reduce((a, c) => a + (c.duration_seconds ?? 0), 0)

  // Por usuário (humano)
  const byUser = new Map<string, { calls: number; answered: number; duration: number; qualified: number }>()
  for (const c of rows) {
    if (c.human_or_ai !== 'human' || !c.user_id) continue
    const entry = byUser.get(c.user_id) ?? { calls: 0, answered: 0, duration: 0, qualified: 0 }
    entry.calls++
    if (c.status === 'completed') { entry.answered++; entry.duration += c.duration_seconds ?? 0 }
    if (c.outcome === 'qualificado') entry.qualified++
    byUser.set(c.user_id, entry)
  }

  // Por agente de IA
  const byAgent = new Map<string, { calls: number; answered: number; qualified: number; costCents: number }>()
  for (const c of rows) {
    if (c.human_or_ai !== 'ai' || !c.ai_agent_id) continue
    const entry = byAgent.get(c.ai_agent_id) ?? { calls: 0, answered: 0, qualified: 0, costCents: 0 }
    entry.calls++
    if (c.status === 'completed') entry.answered++
    if (c.outcome === 'qualificado') entry.qualified++
    entry.costCents += c.althos_cost_cents ?? 0
    byAgent.set(c.ai_agent_id, entry)
  }

  // Nomes
  const userIds = Array.from(byUser.keys())
  const { data: profileRows } = userIds.length ? await supabase.from('profiles').select('id, name, email').in('id', userIds) : { data: [] as any[] }
  const profileById = new Map((profileRows ?? []).map((p: any) => [p.id, p]))

  const agentIds = Array.from(byAgent.keys())
  const { data: agentRows } = agentIds.length ? await supabase.from('voice_ai_agents').select('id, name').in('id', agentIds) : { data: [] as any[] }
  const agentById = new Map((agentRows ?? []).map((a: any) => [a.id, a]))

  // Objeções mais frequentes (aba Insights)
  const { data: insights } = await supabase.from('voice_call_insights').select('objections, voice_calls!inner(organization_id, created_at)').eq('voice_calls.organization_id', org.id).gte('voice_calls.created_at', since.toISOString())
  const objectionCounts = new Map<string, number>()
  for (const row of insights ?? []) {
    for (const obj of (row as any).objections ?? []) {
      objectionCounts.set(obj, (objectionCounts.get(obj) ?? 0) + 1)
    }
  }
  const topObjections = Array.from(objectionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }))

  return {
    ok: true as const,
    summary: {
      total: rows.length,
      answered: answered.length,
      answerRate: rows.length ? Math.round((answered.length / rows.length) * 100) : 0,
      avgDurationSeconds: answered.length ? Math.round(totalDuration / answered.length) : 0,
    },
    byUser: Array.from(byUser.entries()).map(([userId, stats]) => ({ userId, name: profileById.get(userId)?.name || profileById.get(userId)?.email || 'Sem nome', ...stats })),
    byAgent: Array.from(byAgent.entries()).map(([agentId, stats]) => ({ agentId, name: agentById.get(agentId)?.name || 'Agente', ...stats })),
    topObjections,
  }
}
