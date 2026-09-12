'use server'

/**
 * Origem do contato / Indicação — split out of contatos-contactpoints.ts
 * (arquivo já no limite de tamanho) só pra essa preocupação.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { checkContatoPermission } from './contatos-shared'

const setSourceSchema = z.object({
  source: z.string().min(1).max(80),
  // Indicação: quem indicou — de preferência um contato já cadastrado
  // (referred_by_contato_id); texto livre (referred_by_name) quando a
  // pessoa não está no CRM. Os dois só fazem sentido quando source==='indicacao',
  // mas gravar/limpar os dois juntos evita "indicado por" órfão se a origem mudar depois.
  referred_by_contato_id: z.string().uuid().nullable().optional(),
  referred_by_name: z.string().max(160).nullable().optional(),
})

/**
 * Define a origem do contato — inclui o caso "Indicação", registrando quem
 * indicou (contato já cadastrado, com fallback em nome livre).
 */
export async function setContatoSource(orgSlug: string, contatoId: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = setSourceSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Origem inválida.' }
  const { source, referred_by_contato_id, referred_by_name } = parsed.data

  const updates: Record<string, any> = {
    source,
    referred_by_contato_id: source === 'indicacao' ? (referred_by_contato_id || null) : null,
    referred_by_name: source === 'indicacao' ? (referred_by_name?.trim() || null) : null,
  }

  const { error } = await supabase
    .from('contatos')
    .update(updates)
    .eq('id', contatoId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}
