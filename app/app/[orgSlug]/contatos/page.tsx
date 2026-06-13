import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LeadsView from '@/components/features/leads/LeadsView'
import EmptyState from '@/components/ui/empty-state'
import { Users } from 'lucide-react'
import { listSavedFilters } from '@/actions/saved_filters'

const PAGE_SIZE = 25

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'lead', label: 'Leads' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'inativo', label: 'Inativos' },
]

type SP = {
  q?: string
  pipeline_id?: string
  stage?: string
  tag?: string
  has_email?: string
  has_phone?: string
  no_contact_days?: string
  created_from?: string
  created_to?: string
  value_min?: string
  value_max?: string
  tier?: string
  status?: string
  page?: string
}

export default async function ContatosPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: SP
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const page = Math.max(0, (Number(searchParams.page) || 1) - 1)
  const search = searchParams.q || ''
  const pipelineFilter = searchParams.pipeline_id || ''
  const stage = searchParams.stage || ''
  const tag = searchParams.tag || ''
  const hasEmail = searchParams.has_email === '1'
  const hasPhone = searchParams.has_phone === '1'
  const noContactDays = Number(searchParams.no_contact_days) || 0
  const createdFrom = searchParams.created_from || ''
  const createdTo = searchParams.created_to || ''
  const valueMin = Number(searchParams.value_min) || 0
  const valueMax = Number(searchParams.value_max) || 0
  const tier = searchParams.tier || ''
  const status =
    searchParams.status === 'lead' ||
    searchParams.status === 'cliente' ||
    searchParams.status === 'inativo'
      ? searchParams.status
      : ''

  let q = supabase
    .from('contatos')
    .select(
      'id, name, email, phone, status, stage_id, pipeline_id, tags, value_cents, created_at, updated_at, source, ai_score, ai_tier, ai_summary, pipeline_stages(id, name)',
      { count: 'exact' },
    )
    .eq('organization_id', org.id)

  if (status) q = q.eq('status', status)
  if (search) {
    const safe = search.replace(/[%_]/g, '\\$&')
    q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }
  if (pipelineFilter) q = q.eq('pipeline_id', pipelineFilter)
  if (stage) q = q.eq('stage_id', stage)
  if (tag) q = q.contains('tags', [tag])
  if (hasEmail) q = q.not('email', 'is', null)
  if (hasPhone) q = q.not('phone', 'is', null)
  if (createdFrom) q = q.gte('created_at', createdFrom)
  if (createdTo) q = q.lte('created_at', `${createdTo}T23:59:59`)
  if (valueMin > 0) q = q.gte('value_cents', valueMin * 100)
  if (valueMax > 0) q = q.lte('value_cents', valueMax * 100)
  if (noContactDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - noContactDays)
    q = q.lt('updated_at', cutoff.toISOString())
  }
  if (tier === 'hot' || tier === 'warm' || tier === 'cold') q = q.eq('ai_tier', tier)

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [
    { data: leads, count },
    { data: pipelines },
    savedFilters,
    { data: distinctTags },
  ] = await Promise.all([
    q.order('updated_at', { ascending: false }).range(from, to),
    supabase
      .from('pipelines')
      .select('id, name, is_default')
      .eq('organization_id', org.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    listSavedFilters(params.orgSlug, 'leads'),
    supabase.from('contatos').select('tags').eq('organization_id', org.id).limit(1000),
  ])

  // Stages shown in the filter UI: scoped to the selected pipeline, or all stages
  // across all pipelines if no pipeline is filtered.
  let stages: any[] = []
  const stagesScope = pipelineFilter || (pipelines || []).find(p => p.is_default)?.id
  if (stagesScope) {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, pipeline_id')
      .eq('pipeline_id', stagesScope)
      .order('position')
    stages = data || []
  } else if (pipelines && pipelines.length > 0) {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, pipeline_id')
      .in(
        'pipeline_id',
        pipelines.map(p => p.id),
      )
      .order('position')
    stages = data || []
  }

  const tagSet = new Set<string>()
  for (const row of distinctTags || []) {
    for (const t of (row as any).tags || []) tagSet.add(t)
  }
  const allTags = Array.from(tagSet).sort()

  // Preserve all non-status filters when switching status tabs.
  const buildStatusHref = (value: string) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'status' || k === 'page' || !v) continue
      sp.set(k, String(v))
    }
    if (value) sp.set('status', value)
    const qs = sp.toString()
    return `/app/${params.orgSlug}/contatos${qs ? `?${qs}` : ''}`
  }

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contatos</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => {
          const active = status === tab.value
          return (
            <Link
              key={tab.value || 'all'}
              href={buildStatusHref(tab.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )

  if (!leads || leads.length === 0) {
    const isFiltered =
      !!(search || pipelineFilter || stage || tag || hasEmail || hasPhone || createdFrom || createdTo || valueMin || valueMax || noContactDays || tier || status)
    return (
      <div className="space-y-6">
        {header}
        <LeadsView
          orgSlug={params.orgSlug}
          leads={[]}
          total={0}
          page={page}
          pageSize={PAGE_SIZE}
          stages={stages}
          pipelines={pipelines || []}
          allTags={allTags}
          savedFilters={savedFilters}
          filters={searchParams}
        />
        {!isFiltered && (
          <EmptyState
            icon={Users}
            title="Nenhum contato encontrado"
            description="Comece capturando contatos através de formulários ou crie um manualmente."
            actionLabel="Criar Primeiro Contato"
            actionHref={`/app/${params.orgSlug}/pipeline`}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}
      <LeadsView
        orgSlug={params.orgSlug}
        leads={leads as any[]}
        total={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        stages={stages}
        pipelines={pipelines || []}
        allTags={allTags}
        savedFilters={savedFilters}
        filters={searchParams}
      />
    </div>
  )
}
