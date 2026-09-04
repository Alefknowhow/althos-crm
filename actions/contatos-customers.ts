'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { checkContatoPermission } from './contatos-shared'

/* =========================================================
 *  Cliente-style operations (status = 'cliente')
 *  Os campos de cadastro agora vivem direto em contatos.
 * ========================================================= */

export type CustomerListRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  has_documents: boolean
  total_purchased_cents: number
  last_purchase_at: string | null
  became_customer_at: string | null
  assigned_to: string | null
}

export async function listCustomers(orgSlug: string): Promise<CustomerListRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('contatos')
    .select('id, name, email, phone, city, state, became_customer_at, assigned_to')
    .eq('organization_id', org.id)
    .eq('status', 'cliente')
    .order('became_customer_at', { ascending: false })
    .limit(500)

  if (!leads || leads.length === 0) return []

  const leadIds = leads.map(l => l.id)
  const [{ data: sales }, { data: docs }] = await Promise.all([
    supabase
      .from('sales')
      .select('contato_id, amount_cents, sale_date')
      .eq('organization_id', org.id)
      .eq('status', 'completed')
      .in('contato_id', leadIds),
    supabase
      .from('contato_documents')
      .select('contato_id')
      .eq('organization_id', org.id)
      .in('contato_id', leadIds),
  ])

  const totalByLead = new Map<string, { total: number; last: string | null }>()
  for (const s of sales || []) {
    if (!s.contato_id) continue
    const cur = totalByLead.get(s.contato_id) || { total: 0, last: null }
    cur.total += s.amount_cents || 0
    const sDate = s.sale_date as string
    if (!cur.last || sDate > cur.last) cur.last = sDate
    totalByLead.set(s.contato_id, cur)
  }

  const contatosWithDocs = new Set((docs || []).map(d => d.contato_id))

  return leads.map(l => {
    const tally = totalByLead.get(l.id) || { total: 0, last: null }
    return {
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: l.city || null,
      state: l.state || null,
      has_documents: contatosWithDocs.has(l.id),
      total_purchased_cents: tally.total,
      last_purchase_at: tally.last,
      became_customer_at: l.became_customer_at,
      assigned_to: l.assigned_to,
    }
  })
}

export async function getCustomer(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return null
  const supabase = createClient()

  const [{ data: lead }, { data: sales }, { data: activities }, { data: documents }] = await Promise.all([
    supabase
      .from('contatos')
      .select('*, pipeline_stages(name)')
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, quantity, status, payment_method, installments, notes, products(name)')
      .eq('contato_id', leadId)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
    supabase
      .from('contato_activities')
      .select('id, type, payload, created_at')
      .eq('contato_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('contato_documents')
      .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
      .eq('contato_id', leadId)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
  ])

  if (!lead) return null

  return {
    lead,
    // Os campos de cadastro vivem no próprio contato; expomos como `profile`
    // para compatibilidade com os componentes de detalhe.
    profile: lead,
    sales: sales || [],
    activities: activities || [],
    documents: documents || [],
  }
}

/* -------- Cadastro (dados de contato) -------- */

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  passport_expiry: z.string().optional().nullable(),
  has_us_visa: z.boolean().optional(),
  date_of_birth: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  address_notes: z.string().optional().nullable(),
})

/**
 * Atualiza os dados de cadastro (CPF, endereço, passaporte...) direto no
 * contato. Mantém o nome `upsertCustomerProfile` por compatibilidade.
 */
export async function upsertCustomerProfile(orgSlug: string, leadId: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const data: Record<string, any> = { ...parsed.data }
  for (const k of Object.keys(data)) {
    if (data[k] === '') data[k] = null
  }

  const { error } = await supabase
    .from('contatos')
    .update(data)
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

/* =========================================================
 *  NPS (Net Promoter Score)
 * ========================================================= */

/** Disparo manual da pesquisa NPS (0-10) por WhatsApp — o mesmo botão que a
 *  automação "Enviar pesquisa NPS" aciona automaticamente (ver
 *  lib/nps/send-survey.ts, reaproveitado nos dois casos). */
export async function triggerNpsSurvey(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: lead } = await supabase
    .from('contatos')
    .select('id, name, phone')
    .eq('id', leadId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!lead) return { ok: false as const, error: 'Contato não encontrado.' }

  const { sendNpsSurveyCore } = await import('@/lib/nps/send-survey')
  const res = await sendNpsSurveyCore(supabase, org, lead)
  if (!res.ok) return { ok: false as const, error: res.error }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

/** Registro manual da nota (0-10) — cobre o período até a leitura automática
 *  da resposta do WhatsApp existir (pipeline de ingestão em refatoração no
 *  momento). Também funciona pra registrar uma nota vinda de outro canal
 *  (ligação, e-mail, presencial). */
export async function setNpsScore(orgSlug: string, leadId: string, score: number | null) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (score != null && (score < 0 || score > 10 || !Number.isInteger(score))) {
    return { ok: false as const, error: 'A nota precisa ser um número inteiro entre 0 e 10.' }
  }
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({
      nps_score: score,
      nps_status: score != null ? 'respondido' : 'none',
      nps_responded_at: score != null ? new Date().toISOString() : null,
    })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  if (score != null) {
    await supabase.from('contato_activities').insert({
      contato_id: leadId,
      organization_id: org.id,
      type: 'nps_responded',
      payload: { score, manual: true },
      created_by: user.id,
    })
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
