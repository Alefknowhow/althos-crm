'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicPackageStatus } from '@/lib/clinic-constants'

/**
 * Vertical Clínicas — Fase 6: Pacotes de sessões pré-pagos. Integrado ao
 * Financeiro Core (financial_entries) — nunca um financeiro paralelo.
 * Ver supabase/migrations/0168_clinic_treatments_packages.sql.
 */

async function requireTratamentosAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'tratamentos_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicPackageRow = {
  id: string
  patient_contato_id: string
  patient_name: string
  name: string
  total_sessions: number
  sessions_used: number
  value_cents: number | null
  valid_until: string | null
  status: ClinicPackageStatus
  financial_entry_id: string | null
  created_at: string
}

export async function listClinicPackages(orgSlug: string): Promise<ClinicPackageRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_packages')
    .select('id, patient_contato_id, name, total_sessions, sessions_used, value_cents, valid_until, status, financial_entry_id, created_at, contatos(name)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (data || []).map((r: any) => ({
    id: r.id,
    patient_contato_id: r.patient_contato_id,
    patient_name: r.contatos?.name || 'Contato removido',
    name: r.name,
    total_sessions: r.total_sessions,
    sessions_used: r.sessions_used,
    value_cents: r.value_cents,
    valid_until: r.valid_until,
    status: r.status,
    financial_entry_id: r.financial_entry_id,
    created_at: r.created_at,
  }))
}

export type ClinicPackageInput = {
  patient_contato_id: string
  name: string
  total_sessions: number
  value_cents: number | null
  valid_until: string | null
}

export async function createClinicPackage(orgSlug: string, input: ClinicPackageInput) {
  const { org, user } = await requireTratamentosAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  if (!input.name.trim()) return { ok: false as const, error: 'Nome do pacote é obrigatório.' }
  if (!input.total_sessions || input.total_sessions < 1) return { ok: false as const, error: 'Informe o número de sessões.' }
  const supabase = createClient()

  // Lançamento financeiro (Core) — só quando há valor informado. Segue o
  // mesmo padrão de createFinancialEntry (actions/financial.ts), inserido
  // direto aqui pra manter o financial_entry_id no mesmo insert do pacote.
  let financialEntryId: string | null = null
  if (input.value_cents && input.value_cents > 0) {
    const { data: entry, error: feError } = await supabase
      .from('financial_entries')
      .insert({
        organization_id: org.id,
        created_by: user.id,
        tipo: 'receita',
        categoria: 'Pacote clínico',
        valor_cents: input.value_cents,
        contato_id: input.patient_contato_id,
        status: 'pendente',
        observacoes: `Pacote: ${input.name.trim()}`,
      })
      .select('id')
      .maybeSingle()
    if (feError) return { ok: false as const, error: feError.message }
    financialEntryId = entry?.id ?? null
  }

  const { error } = await supabase.from('clinic_packages').insert({
    organization_id: org.id,
    patient_contato_id: input.patient_contato_id,
    name: input.name.trim(),
    total_sessions: input.total_sessions,
    value_cents: input.value_cents || null,
    valid_until: input.valid_until || null,
    financial_entry_id: financialEntryId,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}

export async function updateClinicPackage(orgSlug: string, id: string, input: Partial<Omit<ClinicPackageInput, 'value_cents'>>) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.total_sessions !== undefined) patch.total_sessions = input.total_sessions
  if (input.valid_until !== undefined) patch.valid_until = input.valid_until || null
  const { error } = await supabase.from('clinic_packages').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

export async function deleteClinicPackage(orgSlug: string, id: string) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_packages').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

/** Consome +1 sessão do pacote; marca "utilizado" automaticamente ao
 *  atingir o total. */
export async function consumeClinicPackageSession(orgSlug: string, id: string) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { data: p } = await supabase
    .from('clinic_packages')
    .select('sessions_used, total_sessions, status')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!p) return { ok: false as const, error: 'Pacote não encontrado.' }
  if (p.sessions_used >= p.total_sessions) return { ok: false as const, error: 'Pacote já totalmente utilizado.' }
  const used = p.sessions_used + 1
  const status: ClinicPackageStatus = used >= p.total_sessions ? 'utilizado' : 'ativo'
  const { error } = await supabase
    .from('clinic_packages')
    .update({ sessions_used: used, status })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

export async function setClinicPackageStatus(orgSlug: string, id: string, status: ClinicPackageStatus) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_packages').update({ status }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}
