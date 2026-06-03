'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const ALLOWED_DOC_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
])
const MAX_DOC_SIZE = 10 * 1024 * 1024

/* -------- List + get -------- */

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
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Pull the customer leads with their profile + a tally of completed sales.
  const { data: leads } = await supabase
    .from('leads')
    .select(
      'id, name, email, phone, became_customer_at, assigned_to, customer_profiles(id, city, state)',
    )
    .eq('organization_id', org.id)
    .eq('is_customer', true)
    .order('became_customer_at', { ascending: false })
    .limit(500)

  if (!leads || leads.length === 0) return []

  const leadIds = leads.map(l => l.id)
  const [{ data: sales }, { data: docs }] = await Promise.all([
    supabase
      .from('sales')
      .select('lead_id, amount_cents, sale_date')
      .eq('organization_id', org.id)
      .eq('status', 'completed')
      .in('lead_id', leadIds),
    supabase
      .from('customer_documents')
      .select('customer_profile_id')
      .eq('organization_id', org.id),
  ])

  const totalByLead = new Map<string, { total: number; last: string | null }>()
  for (const s of sales || []) {
    if (!s.lead_id) continue
    const cur = totalByLead.get(s.lead_id) || { total: 0, last: null }
    cur.total += s.amount_cents || 0
    const sDate = s.sale_date as string
    if (!cur.last || sDate > cur.last) cur.last = sDate
    totalByLead.set(s.lead_id, cur)
  }

  const profileWithDocs = new Set((docs || []).map(d => d.customer_profile_id))

  return leads.map(l => {
    const profile = Array.isArray(l.customer_profiles) ? l.customer_profiles[0] : l.customer_profiles
    const tally = totalByLead.get(l.id) || { total: 0, last: null }
    return {
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: profile?.city || null,
      state: profile?.state || null,
      has_documents: profile?.id ? profileWithDocs.has(profile.id) : false,
      total_purchased_cents: tally.total,
      last_purchase_at: tally.last,
      became_customer_at: l.became_customer_at,
      assigned_to: l.assigned_to,
    }
  })
}

export async function getCustomer(orgSlug: string, leadId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const [{ data: lead }, { data: sales }, { data: activities }] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, name, email, phone, value_cents, tags, source, assigned_to, became_customer_at, is_customer, ai_score, ai_tier, ai_summary, created_at, customer_profiles(*)',
      )
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, quantity, status, payment_method, installments, notes, products(name)')
      .eq('lead_id', leadId)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
    supabase
      .from('lead_activities')
      .select('id, type, payload, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!lead) return null

  const profile = Array.isArray(lead.customer_profiles)
    ? lead.customer_profiles[0]
    : lead.customer_profiles

  let documents: any[] = []
  if (profile?.id) {
    const { data: docs } = await supabase
      .from('customer_documents')
      .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
      .eq('customer_profile_id', profile.id)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
    documents = docs || []
  }

  return {
    lead,
    profile: profile || null,
    sales: sales || [],
    activities: activities || [],
    documents,
  }
}

/* -------- Profile upsert -------- */

const profileSchema = z.object({
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
  notes: z.string().optional().nullable(),
})

/**
 * Create or update the customer profile attached to a lead. Idempotent —
 * the profile is unique by lead_id, so we upsert on conflict.
 */
export async function upsertCustomerProfile(orgSlug: string, leadId: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  // Verify the lead is reachable from this org.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!lead) return { ok: false as const, error: 'Lead não encontrado' }

  // Normalize empty strings to null so the DB stores consistent nulls.
  const data: Record<string, any> = { ...parsed.data }
  for (const k of Object.keys(data)) {
    if (data[k] === '') data[k] = null
  }

  const { error } = await supabase
    .from('customer_profiles')
    .upsert(
      { lead_id: leadId, organization_id: org.id, ...data },
      { onConflict: 'lead_id' },
    )

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/clientes/${leadId}`)
  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const }
}

/* -------- Create customer directly -------- */

const newCustomerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
})

/**
 * Create a customer straight from the Clientes tab. Backed by a `leads` row
 * flagged is_customer=true so it flows through the same listing/detail screens.
 * Places it on the first stage of the default pipeline to satisfy NOT NULL FKs.
 */
export async function createCustomer(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = newCustomerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { name, email, phone } = parsed.data

  // Resolve a stage on the default pipeline (leads require pipeline_id/stage_id).
  let pipeline_id: string | undefined
  let stage_id: string | undefined
  const { data: pipeline } = await supabase
    .from('pipelines').select('id').eq('organization_id', org.id).eq('is_default', true).maybeSingle()
  if (pipeline) {
    pipeline_id = pipeline.id
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id').eq('pipeline_id', pipeline.id).order('position').limit(1).maybeSingle()
    stage_id = stage?.id
  }
  if (!stage_id) return { ok: false as const, error: 'Configure um pipeline com pelo menos um estágio antes de criar clientes.' }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      organization_id: org.id,
      pipeline_id,
      stage_id,
      name,
      email: email || null,
      phone: phone || null,
      assigned_to: user.id,
      is_customer: true,
      became_customer_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !lead) return { ok: false as const, error: error?.message || 'Erro ao criar cliente' }

  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const, id: lead.id }
}

/* -------- Customer flag (manual mark/unmark) -------- */

export async function markAsCustomer(orgSlug: string, leadId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('leads')
    .update({ is_customer: true, became_customer_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const }
}

export async function unmarkAsCustomer(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('leads')
    .update({ is_customer: false, became_customer_at: null })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const }
}

/* -------- Documents -------- */

const DOC_KINDS = ['cpf_front', 'cpf_back', 'rg_front', 'rg_back', 'address_proof', 'contract', 'other'] as const

export async function uploadCustomerDocument(
  orgSlug: string,
  customerProfileId: string,
  formData: FormData,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  const kindRaw = String(formData.get('kind') || 'other')
  const kind = (DOC_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'other'

  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_DOC_MIME.has(file.type)) {
    return { ok: false as const, error: `Tipo não permitido: ${file.type}. Use PNG, JPG, WebP ou PDF.` }
  }
  if (file.size > MAX_DOC_SIZE) {
    return { ok: false as const, error: `Arquivo muito grande (>${MAX_DOC_SIZE / 1024 / 1024}MB)` }
  }

  // Verify the profile belongs to this org (RLS will also enforce on insert,
  // but a clean error is better than a vague one).
  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('id', customerProfileId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!profile) return { ok: false as const, error: 'Perfil de cliente não encontrado' }

  const rawName = file.name || 'documento'
  const dotIdx = rawName.lastIndexOf('.')
  const ext = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const base = (dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'doc'

  // Path layout aligned with RLS policy: `{org_id}/{profile_id}/{filename}`.
  const path = `${org.id}/${customerProfileId}/${Date.now()}-${kind}-${base}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('customer-documents')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('uploadCustomerDocument storage error:', uploadError)
    return { ok: false as const, error: uploadError.message }
  }

  const { error: insertError } = await supabase.from('customer_documents').insert({
    customer_profile_id: customerProfileId,
    organization_id: org.id,
    kind,
    file_path: path,
    file_name: rawName,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })

  if (insertError) {
    // Best-effort cleanup if the metadata insert fails.
    await supabase.storage.from('customer-documents').remove([path])
    return { ok: false as const, error: insertError.message }
  }

  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const }
}

export async function deleteCustomerDocument(orgSlug: string, documentId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('customer_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  // Remove the metadata row first; if Storage delete fails the file becomes
  // orphaned but the DB stays consistent — acceptable.
  const { error: dbError } = await supabase
    .from('customer_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', org.id)
  if (dbError) return { ok: false as const, error: dbError.message }

  await supabase.storage.from('customer-documents').remove([doc.file_path])

  revalidatePath(`/app/${orgSlug}/clientes`)
  return { ok: true as const }
}

/**
 * Returns a short-lived signed URL for a private document so the browser
 * can render the image/PDF without exposing the file publicly.
 */
export async function getDocumentSignedUrl(orgSlug: string, documentId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('customer_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  const { data: signed, error } = await supabase.storage
    .from('customer-documents')
    .createSignedUrl(doc.file_path, 60 * 5) // 5 min

  if (error || !signed?.signedUrl) {
    return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  }
  return { ok: true as const, url: signed.signedUrl }
}
