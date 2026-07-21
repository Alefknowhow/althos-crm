'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type TravelBlockRow = {
  id: string
  organization_id: string
  origem: string
  destino: string
  data_ida: string
  data_volta: string | null
  voo_ida: string | null
  horario_ida: string | null
  voo_volta: string | null
  horario_volta: string | null
  assentos_total: number | null
  assentos_disponiveis: number
  prazo: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const WRITABLE = [
  'origem', 'destino', 'data_ida', 'data_volta', 'voo_ida', 'horario_ida',
  'voo_volta', 'horario_volta', 'assentos_total', 'assentos_disponiveis',
  'prazo', 'observacoes',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  for (const k of ['data_volta', 'prazo'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  for (const k of ['assentos_total', 'assentos_disponiveis'] as const) {
    if (k in out) {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : (k === 'assentos_disponiveis' ? 0 : null)
    }
  }
  if ('origem' in out) out.origem = String(out.origem || '').trim().toUpperCase()
  if ('destino' in out) out.destino = String(out.destino || '').trim().toUpperCase()
  return out
}

export async function listTravelBlocks(orgSlug: string): Promise<TravelBlockRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_blocks')
    .select('*')
    .eq('organization_id', org.id)
    .order('data_ida', { ascending: true })
    .limit(1000)
  return (data as TravelBlockRow[]) ?? []
}

export async function createTravelBlock(orgSlug: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.origem?.trim() || !input.destino?.trim()) {
    return { ok: false as const, error: 'Informe origem e destino.' }
  }
  if (!input.data_ida) return { ok: false as const, error: 'Informe a data de ida.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_blocks')
    .insert({ organization_id: org.id, created_by: user.id, ...pick(input) })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar bloqueio' }

  revalidatePath(`/app/${orgSlug}/bloqueios`)
  return { ok: true as const, data: data as TravelBlockRow }
}

export async function updateTravelBlock(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_blocks')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar bloqueio' }

  revalidatePath(`/app/${orgSlug}/bloqueios`)
  return { ok: true as const, data: data as TravelBlockRow }
}

export async function deleteTravelBlock(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('travel_blocks')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir bloqueio' }

  revalidatePath(`/app/${orgSlug}/bloqueios`)
  return { ok: true as const }
}
