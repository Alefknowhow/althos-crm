import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ContatosView from '@/components/features/contatos/ContatosView'
import EmptyState from '@/components/ui/empty-state'
import { Users } from 'lucide-react'
import { listSavedFilters } from '@/actions/saved_filters'
import { listRelationships } from '@/actions/relationships'
import { isTravelNiche } from '@/lib/niche'

const PAGE_SIZE = 50

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
  source?: string
  has_email?: string
  has_phone?: string
  no_contact_days?: string
  created_from?: string
  created_to?: string
  value_min?: string
  value_max?: string
  tier?: string
  status?: string
  sel?: string
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
  const sourceFilter = searchParams.source || ''
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
      'id, name, email, phone, status, source, avatar_url, city, state, tags, value_cents, became_customer_at, last_activity_at, created_at, updated_at, ai_tier',
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
  if (sourceFilter) q = q.eq('source', sourceFilter)
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

  const [{ data: contatos, count }, { data: pipelines }, savedFilters, { data: distinctMeta }] =
    await Promise.all([
      q.order('updated_at', { ascending: false }).range(from, to),
      supabase
        .from('pipelines')
        .select('id, name, is_default')
        .eq('organization_id', org.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
      listSavedFilters(params.orgSlug, 'leads'),
      supabase.from('contatos').select('tags, source').eq('organization_id', org.id).limit(1000),
    ])

  // Distinct tags + sources for the filter UI.
  const tagSet = new Set<string>()
  const sourceSet = new Set<string>()
  for (const row of distinctMeta || []) {
    for (const t of (row as any).tags || []) tagSet.add(t)
    if ((row as any).source) sourceSet.add((row as any).source)
  }
  const allTags = Array.from(tagSet).sort()
  const allSources = Array.from(sourceSet).sort()

  // Mark which rows have documents (small icon in the list).
  const rows = contatos || []
  let docIds = new Set<string>()
  if (rows.length > 0) {
    const { data: docs } = await supabase
      .from('contato_documents')
      .select('contato_id')
      .eq('organization_id', org.id)
      .in(
        'contato_id',
        rows.map(r => r.id),
      )
    docIds = new Set((docs || []).map(d => d.contato_id))
  }
  const listRows = rows.map(r => ({ ...r, has_documents: docIds.has(r.id) }))

  // Selected contato (right panel) — fetched server-side so the embedded
  // edit forms' router.refresh() keeps the panel in sync.
  const selId = searchParams.sel || ''
  let selected: any = null
  if (selId) {
    const [{ data: contato }, { data: documents }, { data: sales }, relationships] =
      await Promise.all([
        supabase
          .from('contatos')
          .select('*, pipeline_stages(name)')
          .eq('id', selId)
          .eq('organization_id', org.id)
          .maybeSingle(),
        supabase
          .from('contato_documents')
          .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
          .eq('contato_id', selId)
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sales')
          .select('id, sale_date, amount_cents, status, payment_method, installments, products(name)')
          .eq('contato_id', selId)
          .eq('organization_id', org.id)
          .order('sale_date', { ascending: false }),
        listRelationships(params.orgSlug, selId),
      ])
    if (contato) {
      selected = {
        contato,
        documents: documents || [],
        sales: sales || [],
        relationships,
      }
    }
  }

  const buildStatusHref = (value: string) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'status' || k === 'page' || k === 'sel' || !v) continue
      sp.set(k, String(v))
    }
    if (value) sp.set('status', value)
    const qs = sp.toString()
    return `/app/${params.orgSlug}/contatos${qs ? `?${qs}` : ''}`
  }

  const isFiltered = !!(
    search ||
    pipelineFilter ||
    stage ||
    tag ||
    sourceFilter ||
    hasEmail ||
    hasPhone ||
    createdFrom ||
    createdTo ||
    valueMin ||
    valueMax ||
    noContactDays ||
    tier ||
    status
  )

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

  return (
    <div className="space-y-6">
      {header}
      <ContatosView
        orgSlug={params.orgSlug}
        contatos={listRows as any[]}
        selected={selected}
        selectedId={selId}
        total={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        pipelines={pipelines || []}
        allTags={allTags}
        allSources={allSources}
        savedFilters={savedFilters}
        filters={searchParams}
        isTravel={isTravelNiche(org.niche)}
      />
      {listRows.length === 0 && !isFiltered && (
        <EmptyState
          icon={Users}
          title="Nenhum contato ainda"
          description="Crie um contato manualmente com o botão +Contato ou capture através de formulários."
        />
      )}
    </div>
  )
}
