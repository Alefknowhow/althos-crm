'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { RELATIONSHIP_KINDS, type RelationshipRow } from '@/lib/relationships'

// =====================================================================
// Parentesco / vínculos entre contatos (contato_relationships).
// Relaciona dois contatos por um tipo de vínculo (mãe, pai, filho, etc.).
// Constantes/tipos puros vivem em '@/lib/relationships' (este arquivo é
// 'use server' e só pode exportar funções async).
// =====================================================================

/**
 * Lista os vínculos de um contato, já com o nome do contato relacionado.
 */
export async function listRelationships(
  orgSlug: string,
  contatoId: string,
): Promise<RelationshipRow[]> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contato_relationships')
    .select('id, kind, note, related_contato_id, related_name, related_cpf, related_birth_date, created_at, related:related_contato_id(name)')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    note: r.note,
    related_contato_id: r.related_contato_id,
    // Vínculo com contato existente: nome vem do join. Vínculo manual: nome
    // é o que foi digitado (related_name já guardado na própria linha).
    related_name: (Array.isArray(r.related) ? r.related[0]?.name : r.related?.name) || r.related_name || 'Contato',
    related_cpf: r.related_cpf,
    related_birth_date: r.related_birth_date,
    created_at: r.created_at,
  }))
}

// Duas formas de criar o vínculo: com um contato já cadastrado (relatedContatoId)
// ou manual (nome + CPF/nascimento opcionais, sem contato próprio no CRM) —
// exatamente uma das duas precisa vir preenchida.
const addSchema = z.object({
  contatoId: z.string().uuid(),
  kind: z.enum(RELATIONSHIP_KINDS),
  note: z.string().trim().max(500).optional().nullable(),
  relatedContatoId: z.string().uuid().optional().nullable(),
  relatedName: z.string().trim().min(1).max(4000).optional().nullable(),
  relatedCpf: z.string().trim().max(20).optional().nullable(),
  relatedBirthDate: z.string().trim().optional().nullable(),
})

/**
 * Cria um vínculo de parentesco — com um contato existente ou manual (pessoa
 * sem contato próprio, ex.: familiar que viaja junto mas nunca vai virar lead).
 */
export async function addRelationship(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = addSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { contatoId, kind, note, relatedContatoId, relatedName, relatedCpf, relatedBirthDate } = parsed.data

  if (!relatedContatoId && !relatedName) {
    return { ok: false as const, error: 'Selecione um contato ou preencha o nome.' }
  }
  if (contatoId === relatedContatoId) {
    return { ok: false as const, error: 'Um contato não pode se relacionar consigo mesmo.' }
  }

  const { error } = await supabase.from('contato_relationships').insert({
    organization_id: org.id,
    contato_id: contatoId,
    related_contato_id: relatedContatoId || null,
    related_name: relatedContatoId ? null : relatedName,
    related_cpf: relatedContatoId ? null : (relatedCpf || null),
    related_birth_date: relatedContatoId ? null : (relatedBirthDate || null),
    kind,
    note: note || null,
  })

  if (error) {
    // Violação de unique constraint → vínculo já existe.
    if (error.code === '23505') {
      return { ok: false as const, error: 'Esse vínculo já existe.' }
    }
    return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

/**
 * Remove um vínculo de parentesco.
 */
export async function deleteRelationship(
  orgSlug: string,
  relationshipId: string,
  contatoId: string,
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('contato_relationships')
    .delete()
    .eq('id', relationshipId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}
