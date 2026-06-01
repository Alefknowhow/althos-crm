'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface RunLead {
  id: string
  name: string | null
  email: string | null
}

export interface RunRow {
  id: string
  status: RunStatus | string
  current_step: number | null
  error: string | null
  started_at: string
  completed_at: string | null
  automation_id: string
  automation_name: string | null
  trigger_type: string | null
  lead: RunLead | null
}

export interface RunsPage {
  rows: RunRow[]
  total: number
  page: number
  pageSize: number
}

export interface RunsFilter {
  page?: number
  pageSize?: number
  status?: RunStatus | 'all'
  automationId?: string | 'all'
  search?: string // lead name/email
  from?: string // ISO date (inclusive)
  to?: string // ISO date (inclusive)
}

function pickFirst<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] || null : x
}

/** Paginated, filterable list of automation runs for the org. */
export async function getAutomationRunsPage(orgSlug: string, filter: RunsFilter = {}): Promise<RunsPage> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20))
  const fromIdx = (page - 1) * pageSize
  const toIdx = fromIdx + pageSize - 1

  const search = filter.search?.trim()
  const leadEmbed = search ? 'leads!inner(id, name, email)' : 'leads(id, name, email)'

  let q = supabase
    .from('automation_runs')
    .select(
      `id, status, current_step, error, started_at, completed_at, automation_id,
       automations(name, trigger_type), ${leadEmbed}`,
      { count: 'exact' },
    )
    .eq('organization_id', org.id)
    .order('started_at', { ascending: false })
    .range(fromIdx, toIdx)

  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.automationId && filter.automationId !== 'all') q = q.eq('automation_id', filter.automationId)
  if (filter.from) q = q.gte('started_at', filter.from)
  if (filter.to) q = q.lte('started_at', filter.to)
  if (search) {
    const esc = search.replace(/[,()]/g, ' ')
    q = q.or(`name.ilike.%${esc}%,email.ilike.%${esc}%`, { foreignTable: 'leads' })
  }

  const { data, count } = await q

  const rows: RunRow[] = (data ?? []).map((r: any) => {
    const auto = pickFirst(r.automations)
    const lead = pickFirst<RunLead>(r.leads)
    return {
      id: r.id,
      status: r.status,
      current_step: r.current_step,
      error: r.error ?? null,
      started_at: r.started_at,
      completed_at: r.completed_at,
      automation_id: r.automation_id,
      automation_name: auto?.name ?? null,
      trigger_type: auto?.trigger_type ?? null,
      lead: lead ? { id: lead.id, name: lead.name, email: lead.email } : null,
    }
  })

  return { rows, total: count ?? 0, page, pageSize }
}

export interface StepLog {
  id: string
  step_index: number
  step_type: string
  status: 'success' | 'error' | 'skipped' | string
  message: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  metadata: Record<string, any>
}

export interface RunDetail {
  run: {
    id: string
    status: RunStatus | string
    current_step: number | null
    error: string | null
    started_at: string
    completed_at: string | null
    trigger_payload: Record<string, any>
    automation_id: string
    automation_name: string | null
    trigger_type: string | null
    steps: Array<{ id?: string; type: string; config: Record<string, any> }>
    lead: RunLead | null
  }
  stepLogs: StepLog[]
}

/** Full execution detail + ordered step logs for the timeline. */
export async function getRunDetail(orgSlug: string, runId: string): Promise<RunDetail | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: run } = await supabase
    .from('automation_runs')
    .select(
      `id, status, current_step, error, started_at, completed_at, trigger_payload, automation_id,
       automations(name, trigger_type, steps), leads(id, name, email)`,
    )
    .eq('organization_id', org.id)
    .eq('id', runId)
    .maybeSingle()

  if (!run) return null

  const auto = pickFirst<any>((run as any).automations)
  const lead = pickFirst<RunLead>((run as any).leads)

  const { data: logs } = await supabase
    .from('automation_step_logs')
    .select('id, step_index, step_type, status, message, started_at, completed_at, duration_ms, metadata_json')
    .eq('organization_id', org.id)
    .eq('run_id', runId)
    .order('step_index', { ascending: true })
    .order('created_at', { ascending: true })

  const stepLogs: StepLog[] = (logs ?? []).map((l: any) => ({
    id: l.id,
    step_index: l.step_index,
    step_type: l.step_type,
    status: l.status,
    message: l.message,
    started_at: l.started_at,
    completed_at: l.completed_at,
    duration_ms: l.duration_ms,
    metadata: l.metadata_json ?? {},
  }))

  return {
    run: {
      id: (run as any).id,
      status: (run as any).status,
      current_step: (run as any).current_step,
      error: (run as any).error ?? null,
      started_at: (run as any).started_at,
      completed_at: (run as any).completed_at,
      trigger_payload: (run as any).trigger_payload ?? {},
      automation_id: (run as any).automation_id,
      automation_name: auto?.name ?? null,
      trigger_type: auto?.trigger_type ?? null,
      steps: Array.isArray(auto?.steps) ? auto.steps : [],
      lead: lead ? { id: lead.id, name: lead.name, email: lead.email } : null,
    },
    stepLogs,
  }
}

/** Automations list for the filter dropdown. */
export async function getAutomationsForFilter(orgSlug: string): Promise<Array<{ id: string; name: string }>> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('automations')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return (data ?? []).map((a: any) => ({ id: a.id, name: a.name }))
}
