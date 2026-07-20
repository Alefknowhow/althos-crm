'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type MedifRecordRow = {
  id: string
  organization_id: string
  contato_id: string | null
  passenger_name: string | null
  data: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function listMedifRecords(orgSlug: string): Promise<MedifRecordRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('medif_records')
    .select('*')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as MedifRecordRow[]) ?? []
}

export async function getMedifRecord(orgSlug: string, id: string): Promise<MedifRecordRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('medif_records')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as MedifRecordRow) ?? null
}

export async function createMedifRecord(orgSlug: string, input: { passengerName?: string; contatoId?: string | null; data: Record<string, string> }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('medif_records')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      contato_id: input.contatoId || null,
      passenger_name: input.passengerName || input.data['passageiro_nome'] || null,
      data: input.data || {},
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar registro MEDIF' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, data: data as MedifRecordRow }
}

export async function updateMedifRecord(orgSlug: string, id: string, input: { passengerName?: string; contatoId?: string | null; data?: Record<string, string> }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const patch: Record<string, any> = {}
  if ('passengerName' in input) patch.passenger_name = input.passengerName || null
  if ('contatoId' in input) patch.contato_id = input.contatoId || null
  if (input.data) patch.data = input.data

  const supabase = createClient()
  const { data, error } = await supabase
    .from('medif_records')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar registro MEDIF' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, data: data as MedifRecordRow }
}

export async function deleteMedifRecord(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('medif_records')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir registro MEDIF' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}

// ── Modelo MEDIF em branco (PDF), um por organização ────────────────────────

export async function getMedifTemplateInfo(orgSlug: string): Promise<{ name: string } | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('medif_template_path, medif_template_name')
    .eq('id', org.id)
    .maybeSingle()
  if (!data?.medif_template_path) return null
  return { name: data.medif_template_name || 'MEDIF.pdf' }
}

export async function getMedifTemplateUrl(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('medif_template_path')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.medif_template_path) return { ok: false as const, error: 'Nenhum modelo MEDIF enviado ainda.' }

  const { data: signed, error } = await supabase.storage
    .from('medif-templates')
    .createSignedUrl(orgRow.medif_template_path, 60 * 5)

  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  return { ok: true as const, url: signed.signedUrl }
}

export async function uploadMedifTemplate(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false as const, error: 'Arquivo vazio' }
  if (file.type !== 'application/pdf') return { ok: false as const, error: 'Envie um arquivo PDF.' }
  if (file.size > 15 * 1024 * 1024) return { ok: false as const, error: 'Arquivo muito grande. O limite é 15 MB.' }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('organizations')
    .select('medif_template_path')
    .eq('id', org.id)
    .maybeSingle()

  const path = `${org.id}/${Date.now()}-medif-template.pdf`
  const name = (file.name || 'MEDIF.pdf').replace(/[\r\n"]/g, '').slice(0, 120)

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('medif-templates')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ medif_template_path: path, medif_template_name: name })
    .eq('id', org.id)
  if (updateError) {
    await supabase.storage.from('medif-templates').remove([path])
    return { ok: false as const, error: updateError.message }
  }

  if (existing?.medif_template_path) {
    await supabase.storage.from('medif-templates').remove([existing.medif_template_path])
  }

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, name }
}

export async function removeMedifTemplate(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('organizations')
    .select('medif_template_path')
    .eq('id', org.id)
    .maybeSingle()

  await supabase
    .from('organizations')
    .update({ medif_template_path: null, medif_template_name: null })
    .eq('id', org.id)

  if (existing?.medif_template_path) {
    await supabase.storage.from('medif-templates').remove([existing.medif_template_path])
  }

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}
