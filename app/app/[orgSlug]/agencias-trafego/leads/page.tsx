import { redirect } from 'next/navigation'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTrafficNiche } from '@/lib/niche'
import { listSavedFilters } from '@/actions/saved_filters'
import LeadsView from '@/components/features/leads/LeadsView'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type SP = {
  q?: string
  pipeline_id?: string
  stage?: string
  tag?: string
  page?: string
}

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase E. Liga o componente
 * LeadsView.tsx (já pronto, nunca importado em lugar nenhum antes) numa
 * rota real, sem entidade paralela — os "leads" são os mesmos `contatos`
 * já usados em /contatos, só filtrados por status='lead' (mesmo filtro
 * que a aba "Leads" da tela de Contatos já usa).
 */
export default async function AgenciaTrafegoLeadsPage({
  params, searchParams,
}: { params: { orgSlug: string }; searchParams: SP }) {
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const supabase = createClient()
  const page = Math.max(0, (Number(searchParams.page) || 1) - 1)
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = supabase
    .from('contatos')
    .select(
      'id, name, email, phone, stage_id, tags, value_cents, source, created_at, updated_at, ai_score, ai_tier, ai_summary, pipeline_stages(id, name)',
      { count: 'exact' },
    )
    .eq('organization_id', org.id)
    .eq('status', 'lead')

  if (searchParams.q) {
    const safe = searchParams.q.replace(/[%_]/g, '\\$&')
    q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }
  if (searchParams.pipeline_id) q = q.eq('pipeline_id', searchParams.pipeline_id)
  if (searchParams.stage) q = q.eq('stage_id', searchParams.stage)
  if (searchParams.tag) q = q.contains('tags', [searchParams.tag])

  const [{ data: leads, count }, { data: pipelines }, { data: stages }, savedFilters, { data: distinctTags }] = await Promise.all([
    q.order('updated_at', { ascending: false }).range(from, to),
    supabase.from('pipelines').select('id, name, is_default').eq('organization_id', org.id).order('is_default', { ascending: false }),
    supabase.from('pipeline_stages').select('id, name, pipeline_id').in(
      'pipeline_id',
      (await supabase.from('pipelines').select('id').eq('organization_id', org.id)).data?.map(p => p.id) || [],
    ),
    listSavedFilters(params.orgSlug, 'leads'),
    supabase.from('contatos').select('tags').eq('organization_id', org.id).eq('status', 'lead').limit(1000),
  ])

  const tagSet = new Set<string>()
  for (const row of distinctTags || []) for (const t of (row as any).tags || []) tagSet.add(t)

  return (
    <LeadsView
      orgSlug={params.orgSlug}
      leads={(leads || []) as any}
      total={count || 0}
      page={page}
      pageSize={PAGE_SIZE}
      stages={stages || []}
      pipelines={pipelines || []}
      allTags={Array.from(tagSet).sort()}
      savedFilters={savedFilters}
      filters={searchParams}
    />
  )
}
