'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAutomations(orgSlug: string) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return []

  const { data, error } = await supabase
    .from('automations')
    .select('id, name, is_active, trigger_type, trigger_config, steps, created_at, updated_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching automations:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Single query: fetch all runs for this month and aggregate in memory.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const ids = data.map((a: any) => a.id)
  const { data: runs } = await supabase
    .from('automation_runs')
    .select('automation_id')
    .in('automation_id', ids)
    .gte('created_at', monthStart)

  const counts = new Map<string, number>()
  for (const r of runs || []) {
    counts.set(r.automation_id, (counts.get(r.automation_id) || 0) + 1)
  }

  return data.map((auto: any) => ({ ...auto, runsThisMonth: counts.get(auto.id) || 0 }))
}

export async function getAutomation(orgSlug: string, id: string) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return null

  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching automation:', error)
    return null
  }
  return data
}

export async function getAutomationRuns(orgSlug: string, automationId: string) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return []

  const { data } = await supabase
    .from('automation_runs')
    .select('*, leads(name, email)')
    .eq('automation_id', automationId)
    .eq('organization_id', org.id)
    .order('started_at', { ascending: false })
    .limit(50)

  return data || []
}

export async function getLeadAutomationRuns(orgSlug: string, leadId: string) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return []

  const { data } = await supabase
    .from('automation_runs')
    .select('*, automations(name)')
    .eq('lead_id', leadId)
    .eq('organization_id', org.id)
    .order('started_at', { ascending: false })

  return data || []
}

export async function createAutomation(orgSlug: string, payload: any) {
  // Use regular client for org lookup (validates user has access)
  const supabase = createClient()
  const { data: org, error: orgError } = await supabase
    .from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (orgError) {
    console.error('createAutomation org lookup error:', orgError)
    throw new Error(orgError.message)
  }
  if (!org) throw new Error('Organização não encontrada')

  // Use admin client for the write to bypass RLS (access already verified above)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('automations')
    .insert({
      organization_id: org.id,
      name: payload.name,
      trigger_type: payload.trigger_type || 'form.submitted',
      trigger_config: payload.trigger_config || {},
      steps: payload.steps || []
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('createAutomation insert error:', error)
    throw new Error(error.message || 'Erro ao criar automação')
  }
  revalidatePath(`/app/${orgSlug}/automacoes`)
  return data
}

export async function updateAutomation(orgSlug: string, id: string, payload: any) {
  const supabase = createClient()
  const { data: org } = await supabase
    .from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return { ok: false, error: 'Organização não encontrada' }

  const allowed: any = {}
  if (payload.name !== undefined) allowed.name = payload.name
  if (payload.is_active !== undefined) allowed.is_active = payload.is_active
  if (payload.trigger_type !== undefined) allowed.trigger_type = payload.trigger_type
  if (payload.trigger_config !== undefined) allowed.trigger_config = payload.trigger_config
  if (payload.steps !== undefined) allowed.steps = payload.steps

  const admin = createAdminClient()
  const { error } = await admin
    .from('automations')
    .update(allowed)
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    console.error('updateAutomation error:', error)
    return { ok: false, error: error.message || 'Erro ao salvar automação' }
  }
  revalidatePath(`/app/${orgSlug}/automacoes`)
  revalidatePath(`/app/${orgSlug}/automacoes/${id}`)
  return { ok: true }
}

/** Returns a map of stepIndex → { success, errors } for all historical runs of an automation. */
export async function getStepStats(orgSlug: string, automationId: string): Promise<Record<number, { success: number; errors: number }>> {
  try {
    const supabase = createClient()
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
    if (!org) return {}

    const { data, error } = await supabase
      .from('automation_step_logs')
      .select('step_index, status')
      .eq('automation_id', automationId)
      .eq('organization_id', org.id)

    if (error) return {}

    const result: Record<number, { success: number; errors: number }> = {}
    for (const row of data || []) {
      if (!result[row.step_index]) result[row.step_index] = { success: 0, errors: 0 }
      if (row.status === 'success') result[row.step_index].success++
      if (row.status === 'error')   result[row.step_index].errors++
    }
    return result
  } catch {
    return {}
  }
}

export async function deleteAutomation(orgSlug: string, id: string) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return { ok: false, error: 'Organização não encontrada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('automations')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/automacoes`)
  return { ok: true }
}

export async function toggleAutomation(orgSlug: string, id: string, isActive: boolean) {
  const supabase = createClient()
  const { data: org } = await supabase
    .from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return { ok: false, error: 'Organização não encontrada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('automations')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    console.error('toggleAutomation error:', error)
    return { ok: false, error: error.message }
  }
  revalidatePath(`/app/${orgSlug}/automacoes`)
  return { ok: true }
}
