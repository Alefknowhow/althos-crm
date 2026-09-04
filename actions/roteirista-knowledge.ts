'use server'

/**
 * Roteirista knowledge base CRUD. Split out of actions/roteirista.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRoteiristaAccess } from './roteirista'

export type RoteiristaKnowledgeItem = {
  id: string
  content: string
  is_active: boolean
  created_at: string
}

export async function listRoteiristaKnowledge(orgSlug: string): Promise<RoteiristaKnowledgeItem[]> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('roteirista_knowledge_items')
    .select('id, content, is_active, created_at')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: false })
  return (data || []) as RoteiristaKnowledgeItem[]
}

export async function addRoteiristaKnowledge(orgSlug: string, content: string) {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  if (!content?.trim()) return { ok: false as const, error: 'Escreva o conhecimento antes de salvar.' }

  const supabase = createClient()
  const { error } = await supabase.from('roteirista_knowledge_items').insert({
    organization_id: access.org.id,
    content: content.trim(),
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true as const }
}

export async function deleteRoteiristaKnowledge(orgSlug: string, id: string) {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const supabase = createClient()
  const { error } = await supabase
    .from('roteirista_knowledge_items')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true as const }
}
