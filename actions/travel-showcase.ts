'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type ShowcaseRow = {
  id: string
  organization_id: string
  created_by: string | null
  title: string | null
  category: string | null
  youtube_url: string | null
  briefing: string | null
  cover_photos: string[]
  is_published: boolean
  start_date: string | null
  end_date: string | null
  destinations: any[]
  flights: any[]
  hotels: any[]
  services: Record<string, any>
  included: string[]
  not_included: string[]
  order_bumps: any[]
  total_cents: number
  pax_count: number | null
  price_per_person_cents: number | null
  payment: Record<string, any>
  notes: string | null
  created_at: string
  updated_at: string
}

// Whitelist of body fields a client may write. Mantém o shape jsonb previsível.
const WRITABLE = [
  'title', 'category', 'youtube_url', 'briefing', 'cover_photos', 'is_published',
  'start_date', 'end_date', 'destinations', 'flights', 'hotels',
  'services', 'included', 'not_included', 'order_bumps',
  'total_cents', 'pax_count', 'price_per_person_cents', 'payment', 'notes',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) {
    if (k in input) out[k] = input[k]
  }
  for (const k of ['total_cents', 'pax_count', 'price_per_person_cents'] as const) {
    if (k in out && out[k] !== null) {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.round(n) : 0
    }
  }
  return out
}

export async function listPackages(orgSlug: string): Promise<ShowcaseRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_showcase_packages')
    .select('*')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as ShowcaseRow[]) ?? []
}

export async function getPackage(orgSlug: string, id: string): Promise<ShowcaseRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_showcase_packages')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as ShowcaseRow) ?? null
}

// Token público da vitrine da organização (página /v/[token]).
export async function getVitrineToken(orgSlug: string): Promise<string | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('vitrine_token')
    .eq('id', org.id)
    .maybeSingle()
  return (data as any)?.vitrine_token ?? null
}

export async function createPackage(orgSlug: string, input: Record<string, any> = {}) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_showcase_packages')
    .insert({
      ...pick(input),
      title: input.title || 'Novo pacote',
      organization_id: org.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao criar pacote' }
  revalidatePath(`/app/${orgSlug}/ofertas`)
  return { ok: true as const, data: data as ShowcaseRow }
}

export async function updatePackage(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_showcase_packages')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar pacote' }
  if (!data) return { ok: false as const, error: 'Pacote não encontrado nesta organização.' }

  revalidatePath(`/app/${orgSlug}/ofertas`)
  revalidatePath(`/app/${orgSlug}/ofertas/${id}`)
  return { ok: true as const, data: data as ShowcaseRow }
}

export async function deletePackage(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('travel_showcase_packages')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir pacote' }
  revalidatePath(`/app/${orgSlug}/ofertas`)
  return { ok: true as const }
}

// "Gerar proposta": copia os dados do pacote da vitrine para uma nova
// travel_proposals, deixando os campos de cliente em branco para o vendedor
// completar com o lead. Retorna o id da proposta criada.
export async function generateProposalFromPackage(orgSlug: string, packageId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: pkg } = await supabase
    .from('travel_showcase_packages')
    .select('*')
    .eq('id', packageId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!pkg) return { ok: false as const, error: 'Pacote não encontrado.' }
  const p = pkg as ShowcaseRow

  const { data, error } = await supabase
    .from('travel_proposals')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      title: p.title || 'Proposta a partir da vitrine',
      status: 'draft',
      start_date: p.start_date,
      end_date: p.end_date,
      // campos de cliente ficam em branco — serão preenchidos depois
      client_name: null,
      contato_id: null,
      destinations: p.destinations ?? [],
      flights: p.flights ?? [],
      hotels: p.hotels ?? [],
      services: p.services ?? {},
      included: p.included ?? [],
      not_included: p.not_included ?? [],
      order_bumps: p.order_bumps ?? [],
      total_cents: p.total_cents ?? 0,
      pax_count: p.pax_count,
      price_per_person_cents: p.price_per_person_cents,
      payment: p.payment ?? {},
      notes: p.briefing || null,
    })
    .select('id')
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao gerar proposta' }
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, data: data as { id: string } }
}
