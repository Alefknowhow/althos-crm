'use server'

/**
 * Vertical Clínicas — especialidades, profissionais e salas.
 * Split out of actions/clinic.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export async function requireProfissionaisAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'profissionais')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return org
}

// ── Especialidades ──────────────────────────────────────────────────────────

export type ClinicSpecialty = { id: string; name: string; active: boolean }

export async function listClinicSpecialties(orgSlug: string): Promise<ClinicSpecialty[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_specialties')
    .select('id, name, active')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return data || []
}

export async function createClinicSpecialty(orgSlug: string, name: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const trimmed = name.trim()
  if (!trimmed) return { ok: false as const, error: 'Nome é obrigatório.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').insert({ organization_id: org.id, name: trimmed })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicSpecialty(orgSlug: string, id: string, patch: { name?: string; active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function deleteClinicSpecialty(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// ── Profissionais ────────────────────────────────────────────────────────────

export type ClinicProfessional = {
  id: string
  name: string
  specialty_id: string | null
  registration_no: string | null
  commission_pct: number | null
  active: boolean
  phone: string | null
  email: string | null
  avatar_storage_object_id: string | null
  /** Preenchido só na leitura (signed URL do R2) — ver resolveClinicProfessionalAvatars. */
  avatar_url?: string | null
  /** Contato que é a fonte de verdade do cadastro pessoal — null nos
   *  profissionais legados (cadastrados antes do vínculo com Contatos). */
  contato_id: string | null
}

/**
 * Cadastro base (nome/foto/telefone/e-mail) vive em `contatos`;
 * clinic_professionals é o VÍNCULO clínico (especialidade/registro/
 * comissão). Faz LEFT JOIN e acha campo-a-campo: contato tem prioridade,
 * cai pros campos legados da própria linha quando não há contato_id
 * (profissional cadastrado antes dessa mudança).
 */
export async function listClinicProfessionals(orgSlug: string): Promise<ClinicProfessional[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_professionals')
    .select('id, name, specialty_id, registration_no, commission_pct, active, phone, email, avatar_storage_object_id, contato_id, contatos(name, phone, email, avatar_storage_object_id)')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })

  const rows = (data || []).map((r: any) => ({
    id: r.id,
    specialty_id: r.specialty_id,
    registration_no: r.registration_no,
    commission_pct: r.commission_pct,
    active: r.active,
    contato_id: r.contato_id,
    name: r.contatos?.name || r.name,
    phone: r.contatos?.phone ?? r.phone,
    email: r.contatos?.email ?? r.email,
    avatar_storage_object_id: r.contatos?.avatar_storage_object_id ?? r.avatar_storage_object_id,
  }))
  return resolveClinicProfessionalAvatars(orgSlug, rows)
}

/** Resolve avatar_storage_object_id → signed URL do R2 em lote — mesmo
 *  padrão de resolveContatoAvatars (actions/contatos.ts). */
export async function resolveClinicProfessionalAvatars<T extends { avatar_storage_object_id: string | null }>(
  orgSlug: string,
  rows: T[],
): Promise<(T & { avatar_url: string | null })[]> {
  const objectIds = rows.map(r => r.avatar_storage_object_id).filter((id): id is string => !!id)
  if (objectIds.length === 0) return rows.map(r => ({ ...r, avatar_url: null }))
  const { getObjectSignedUrls } = await import('@/actions/storage')
  const urls = await getObjectSignedUrls(orgSlug, objectIds)
  return rows.map(r => ({
    ...r,
    avatar_url: r.avatar_storage_object_id ? urls.get(r.avatar_storage_object_id) ?? null : null,
  }))
}

export type ClinicProfessionalInput = {
  /** Contato que é a fonte de verdade do cadastro pessoal — obrigatório pra
   *  profissionais novos (cadastro base agora é feito em Contatos). */
  contato_id: string
  specialty_id: string | null
  registration_no: string | null
  commission_pct: number | null
}

export async function createClinicProfessional(orgSlug: string, input: ClinicProfessionalInput) {
  const org = await requireProfissionaisAccess(orgSlug)
  if (!input.contato_id) return { ok: false as const, error: 'Selecione um contato.' }
  const supabase = createClient()

  const { data: contato } = await supabase.from('contatos').select('name').eq('id', input.contato_id).eq('organization_id', org.id).maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado.' }

  const { error } = await supabase.from('clinic_professionals').insert({
    organization_id: org.id,
    contato_id: input.contato_id,
    name: contato.name, // cópia denormalizada (fallback caso o contato seja excluído — contato_id vira null via ON DELETE SET NULL)
    specialty_id: input.specialty_id || null,
    registration_no: input.registration_no || null,
    commission_pct: input.commission_pct ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicProfessional(orgSlug: string, id: string, input: Partial<ClinicProfessionalInput> & { active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.contato_id !== undefined) patch.contato_id = input.contato_id || null
  if (input.specialty_id !== undefined) patch.specialty_id = input.specialty_id || null
  if (input.registration_no !== undefined) patch.registration_no = input.registration_no || null
  if (input.commission_pct !== undefined) patch.commission_pct = input.commission_pct
  if (input.active !== undefined) patch.active = input.active
  const { error } = await supabase.from('clinic_professionals').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// Upload de foto/telefone/e-mail do profissional passou a ser feito no
// cadastro do Contato vinculado (actions/contatos.ts::uploadContatoAvatar) —
// removido daqui pra não ter duas fontes de verdade. Profissionais legados
// sem contato_id mantêm os campos próprios (avatar_storage_object_id/phone/
// email) só como fallback de leitura em listClinicProfessionals.

export async function deleteClinicProfessional(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_professionals').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// ── Salas ────────────────────────────────────────────────────────────────────

export type ClinicRoom = { id: string; name: string; active: boolean }

export async function listClinicRooms(orgSlug: string): Promise<ClinicRoom[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_rooms')
    .select('id, name, active')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return data || []
}

export async function createClinicRoom(orgSlug: string, name: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const trimmed = name.trim()
  if (!trimmed) return { ok: false as const, error: 'Nome é obrigatório.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').insert({ organization_id: org.id, name: trimmed })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicRoom(orgSlug: string, id: string, patch: { name?: string; active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function deleteClinicRoom(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}
