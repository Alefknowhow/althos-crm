'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Form Insights ────────────────────────────────────────────────────────────

export type FormInsights = {
  form: { id: string; name: string; slug: string; is_active: boolean } | null
  totalSubmissions: number
  last30: number
  prev30: number
  byDay: { date: string; count: number }[]
  topSources: { source: string; count: number }[]
  topCampaigns: { campaign: string; count: number }[]
  topMediums: { medium: string; count: number }[]
}

export async function getFormInsights(
  orgSlug: string,
  formId: string,
): Promise<FormInsights> {
  const empty: FormInsights = {
    form: null,
    totalSubmissions: 0,
    last30: 0,
    prev30: 0,
    byDay: [],
    topSources: [],
    topCampaigns: [],
    topMediums: [],
  }

  const supabase = createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!org) return empty

  const { data: form } = await supabase
    .from('forms')
    .select('id, name, slug, is_active')
    .eq('id', formId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!form) return empty

  const now = new Date()
  const last30Start = new Date(now)
  last30Start.setDate(now.getDate() - 30)
  const prev30Start = new Date(now)
  prev30Start.setDate(now.getDate() - 60)

  // Total
  const { count: total } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId)

  // Last 30 days
  const { count: last30 } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId)
    .gte('created_at', last30Start.toISOString())

  // Previous 30 days
  const { count: prev30 } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId)
    .gte('created_at', prev30Start.toISOString())
    .lt('created_at', last30Start.toISOString())

  // Daily breakdown (last 30 days) — fetch rows and group in JS
  const { data: rows } = await supabase
    .from('form_submissions')
    .select('created_at, utm_source, utm_medium, utm_campaign')
    .eq('form_id', formId)
    .gte('created_at', last30Start.toISOString())
    .order('created_at', { ascending: true })

  // Build byDay map
  const dayMap: Record<string, number> = {}
  // Pre-fill all 30 days with 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Start)
    d.setDate(last30Start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = 0
  }
  const sourceMap: Record<string, number> = {}
  const campaignMap: Record<string, number> = {}
  const mediumMap: Record<string, number> = {}

  for (const r of rows ?? []) {
    const day = (r.created_at as string).slice(0, 10)
    if (day in dayMap) dayMap[day]++
    const src = r.utm_source || '(direto)'
    sourceMap[src] = (sourceMap[src] || 0) + 1
    const cam = r.utm_campaign || '(sem campanha)'
    campaignMap[cam] = (campaignMap[cam] || 0) + 1
    const med = r.utm_medium || '(sem mídia)'
    mediumMap[med] = (mediumMap[med] || 0) + 1
  }

  const byDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

  const topSources = Object.entries(sourceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }))

  const topCampaigns = Object.entries(campaignMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([campaign, count]) => ({ campaign, count }))

  const topMediums = Object.entries(mediumMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([medium, count]) => ({ medium, count }))

  return {
    form,
    totalSubmissions: total || 0,
    last30: last30 || 0,
    prev30: prev30 || 0,
    byDay,
    topSources,
    topCampaigns,
    topMediums,
  }
}

// ─── Single lead's form responses (for the pipeline card popup) ────────────────

export type LeadFormResponse = {
  submissionId: string
  formName: string
  createdAt: string
  qa: { label: string; value: string }[]
}

/**
 * All form submissions tied to a given lead, with each field resolved to its
 * human label using the form's schema. Used by the "ver respostas" button on
 * pipeline cards.
 */
export async function getLeadFormResponses(
  orgSlug: string,
  leadId: string,
): Promise<LeadFormResponse[]> {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return []

  const { data: subs } = await supabase
    .from('form_submissions')
    .select('id, created_at, data, form_id, forms(name, schema, organization_id)')
    .eq('contato_id', leadId)
    .order('created_at', { ascending: false })

  const out: LeadFormResponse[] = []
  for (const s of subs ?? []) {
    const form: any = Array.isArray((s as any).forms) ? (s as any).forms[0] : (s as any).forms
    // Defense-in-depth: only surface forms from the caller's org.
    if (!form || form.organization_id !== org.id) continue

    const fields: any[] = form?.schema?.fields ?? []
    const labelById: Record<string, string> = {}
    for (const f of fields) labelById[f.id] = f.label || f.id

    const raw = ((s as any).data ?? {}) as Record<string, any>
    const qa = Object.entries(raw).map(([key, val]) => ({
      label: labelById[key] || key,
      value: Array.isArray(val) ? val.join(', ') : val == null ? '' : String(val),
    }))

    out.push({
      submissionId: (s as any).id,
      formName: form?.name || 'Formulário',
      createdAt: (s as any).created_at,
      qa,
    })
  }

  return out
}

// ─── Submissions list ─────────────────────────────────────────────────────────

export type SubmissionFilters = {
  from?: string | null
  to?: string | null
  utmSource?: string | null
  utmCampaign?: string | null
  page?: number
  pageSize?: number
}

export async function getFormWithSubmissions(
  orgSlug: string,
  formId: string,
  filters: SubmissionFilters = {}
) {
  const supabase = createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (!org) return { form: null, submissions: [], total: 0 }

  const { data: form } = await supabase
    .from('forms')
    .select('*')
    .eq('id', formId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!form) return { form: null, submissions: [], total: 0 }

  const pageSize = filters.pageSize ?? 25
  const page = filters.page ?? 0
  const fromIdx = page * pageSize
  const toIdx = fromIdx + pageSize - 1

  let q = supabase
    .from('form_submissions')
    .select(
      'id, created_at, data, meta, contato_id, utm_source, utm_medium, utm_campaign, contatos(id, name, email, phone)',
      { count: 'exact' },
    )
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .range(fromIdx, toIdx)

  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', filters.to)
  if (filters.utmSource) q = q.ilike('utm_source', `%${filters.utmSource}%`)
  if (filters.utmCampaign) q = q.ilike('utm_campaign', `%${filters.utmCampaign}%`)

  const { data, count, error } = await q
  if (error) {
    console.error('getFormWithSubmissions error:', error)
    return { form, submissions: [], total: 0 }
  }

  return { form, submissions: data || [], total: count || 0 }
}
