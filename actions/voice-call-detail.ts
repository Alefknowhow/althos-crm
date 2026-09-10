'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

export async function getCallFullDetail(orgSlug: string, voiceCallId: string) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const org = await getCurrentOrganization(orgSlug) as any

  const supabase = createClient()
  const { data: call, error } = await supabase
    .from('voice_calls')
    .select('*, contatos(id, name, phone), voice_ai_agents(name), voice_recordings(url, duration_seconds), voice_transcripts(full_text, segments), voice_call_insights(*)')
    .eq('id', voiceCallId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (error || !call) return { ok: false as const, error: error?.message || 'Chamada não encontrada.' }
  return { ok: true as const, call }
}

/** "Criar tarefa" a partir de uma sugestão do resumo de IA (voice_call_insights.suggested_tasks). */
export async function createTaskFromCallInsight(orgSlug: string, contatoId: string, title: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }

  const supabase = createClient()
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 1)
  const { error } = await supabase.from('tasks').insert({
    organization_id: org.id, contato_id: contatoId, title, due_date: dueDate.toISOString(),
    status: 'pending', assigned_to: user.id, created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
