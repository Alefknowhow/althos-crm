'use server'

/**
 * AI attendant knowledge base (FAQ) CRUD.
 * Split out of actions/ai_attendant.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

export type KnowledgeItem = {
  id: string
  category: string | null
  question: string
  answer: string
  priority: number
  is_active: boolean
  created_at: string
}

export async function listKnowledge(orgSlug: string): Promise<KnowledgeItem[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_knowledge_items')
    .select('id, category, question, answer, priority, is_active, created_at')
    .eq('organization_id', org.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
  return (data || []) as KnowledgeItem[]
}

const knowledgeInput = z.object({
  category: z.string().optional().nullable(),
  question: z.string().min(2),
  answer: z.string().min(2),
  priority: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function createKnowledge(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = knowledgeInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('ai_knowledge_items').insert({
    organization_id: org.id,
    category: parsed.data.category || null,
    question: parsed.data.question,
    answer: parsed.data.answer,
    priority: parsed.data.priority ?? 0,
    is_active: parsed.data.is_active ?? true,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}

export async function updateKnowledge(orgSlug: string, id: string, raw: unknown) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const parsed = knowledgeInput.partial().safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('ai_knowledge_items')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}

export async function deleteKnowledge(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_knowledge_items')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}
