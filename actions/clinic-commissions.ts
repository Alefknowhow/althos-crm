'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicCommissionStatus, ClinicCommissionSourceType } from '@/lib/clinic-constants'

/**
 * Vertical Clínicas — Fase 8: Comissões. Cálculo rastreável por
 * profissional a partir do commission_pct cadastrado — nunca move
 * dinheiro sozinho, só registra o cálculo (o pagamento em si continua
 * sendo um lançamento manual no Financeiro Core, fora deste módulo).
 * Ver supabase/migrations/0170_clinic_commissions.sql.
 */

async function requireComissoesAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'comissoes_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

/**
 * Gera (idempotente, via unique index em source_type/source_id) uma
 * comissão automática quando o profissional tem commission_pct > 0.
 * Chamada a partir de setClinicQuoteStatus (orçamento aprovado),
 * setClinicAppointmentStatus (atendimento realizado) e
 * createClinicPackage (pacote vendido) — nunca chamada direto pela UI.
 * Não usa requireComissoesAccess: roda internamente dentro de outra
 * action já autorizada pelo seu próprio módulo (orçamentos/agendamentos/
 * pacotes), então usa o client normal (RLS já isola por org).
 */
export async function maybeCreateClinicCommission(params: {
  organizationId: string
  professionalId: string | null
  patientContatoId: string | null
  sourceType: ClinicCommissionSourceType
  sourceId: string
  baseAmountCents: number
}) {
  if (!params.professionalId || params.baseAmountCents <= 0) return
  const supabase = createClient()
  const { data: prof } = await supabase
    .from('clinic_professionals')
    .select('commission_pct')
    .eq('id', params.professionalId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()
  const pct = prof?.commission_pct
  if (!pct || Number(pct) <= 0) return

  const commissionCents = Math.round((params.baseAmountCents * Number(pct)) / 100)
  await supabase.from('clinic_commissions').upsert(
    {
      organization_id: params.organizationId,
      professional_id: params.professionalId,
      patient_contato_id: params.patientContatoId,
      source_type: params.sourceType,
      source_id: params.sourceId,
      base_amount_cents: params.baseAmountCents,
      commission_pct: pct,
      commission_cents: commissionCents,
    },
    { onConflict: 'source_type,source_id', ignoreDuplicates: true },
  )
}

export type ClinicCommissionRow = {
  id: string
  professional_id: string
  professional_name: string
  patient_contato_id: string | null
  patient_name: string | null
  source_type: ClinicCommissionSourceType
  base_amount_cents: number
  commission_pct: number
  commission_cents: number
  status: ClinicCommissionStatus
  competencia: string
  notes: string | null
}

export async function listClinicCommissions(orgSlug: string): Promise<ClinicCommissionRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_commissions')
    .select('id, professional_id, patient_contato_id, source_type, base_amount_cents, commission_pct, commission_cents, status, competencia, notes, clinic_professionals(name), contatos(name)')
    .eq('organization_id', org.id)
    .order('competencia', { ascending: false })
    .limit(300)

  return (data || []).map((r: any) => ({
    id: r.id,
    professional_id: r.professional_id,
    professional_name: r.clinic_professionals?.name || 'Profissional removido',
    patient_contato_id: r.patient_contato_id,
    patient_name: r.contatos?.name || null,
    source_type: r.source_type,
    base_amount_cents: r.base_amount_cents,
    commission_pct: Number(r.commission_pct),
    commission_cents: r.commission_cents,
    status: r.status,
    competencia: r.competencia,
    notes: r.notes,
  }))
}

export async function createManualClinicCommission(orgSlug: string, input: {
  professional_id: string
  base_amount_cents: number
  commission_pct: number
  notes: string | null
}) {
  const { org, user } = await requireComissoesAccess(orgSlug)
  if (!input.professional_id) return { ok: false as const, error: 'Selecione o profissional.' }
  if (!input.base_amount_cents || input.base_amount_cents <= 0) return { ok: false as const, error: 'Informe um valor base válido.' }
  if (!input.commission_pct || input.commission_pct <= 0) return { ok: false as const, error: 'Informe um percentual válido.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_commissions').insert({
    organization_id: org.id,
    professional_id: input.professional_id,
    source_type: 'manual',
    base_amount_cents: input.base_amount_cents,
    commission_pct: input.commission_pct,
    commission_cents: Math.round((input.base_amount_cents * input.commission_pct) / 100),
    notes: input.notes || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/comissoes`)
  return { ok: true as const }
}

export async function setClinicCommissionStatus(orgSlug: string, id: string, status: ClinicCommissionStatus) {
  const { org } = await requireComissoesAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_commissions').update({ status }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/comissoes`)
  return { ok: true as const }
}

export async function deleteClinicCommission(orgSlug: string, id: string) {
  const { org } = await requireComissoesAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_commissions').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/comissoes`)
  return { ok: true as const }
}
