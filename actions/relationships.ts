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
    .select('id, kind, note, related_contato_id, created_at, related:related_contato_id(name)')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    note: r.note,
    related_contato_id: r.related_contato_id,
    related_name: Array.isArray(r.related) ? r.related[0]?.name : r.related?.name,
    created_at: r.created_at,
  }))
}

const addSchema = z.object({
  contatoId: z.string().uuid(),
  relatedContatoId: z.string().uuid(),
  kind: z.enum(RELATIONSHIP_KINDS),
  note: z.string().trim().max(500).optional().nullable(),
})

/**
 * Cria um vínculo de parentesco. O vínculo é direcionado
 * (contato -> related), mas também cria a aresta inversa quando faz sentido,
 * para que ambos os contatos exibam o relacionamento.
 */
export async function addRelationship(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = addSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { contatoId, relatedContatoId, kind, note } = parsed.data
  if (contatoId === relatedContatoId) {
    return { ok: false as const, error: 'Um contato não pode se relacionar consigo mesmo.' }
  }

  const { error } = await supabase.from('contato_relationships').insert({
    organization_id: org.id,
    contato_id: contatoId,
    related_contato_id: relatedContatoId,
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
