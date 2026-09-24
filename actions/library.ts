'use server'

/**
 * CRUD da Biblioteca / Agent Knowledge compartilhada (issue #50). Mesmo
 * padrão de actions/ai_attendant-knowledge.ts (FAQ do atendente WhatsApp),
 * permissão 'settings' por ser conteúdo que passa a alimentar múltiplos
 * agentes de IA da org, não uma tela isolada.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'
import type { LibraryItem } from '@/lib/ai/library'

async function requireLibraryAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

export async function listLibraryItems(orgSlug: string): Promise<{ ok: true; items: LibraryItem[] } | { ok: false; error: string }> {
  const access = await requireLibraryAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { data, error } = await supabase
    .from('library_items')
    .select('*')
    .eq('organization_id', access.org.id)
    .order('priority', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, items: (data ?? []) as LibraryItem[] }
}

const LibraryItemInput = z.object({
  category: z.string().trim().max(80).optional().nullable(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(8000),
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
})

export async function createLibraryItem(orgSlug: string, input: unknown): Promise<{ ok: true; item: LibraryItem } | { ok: false; error: string }> {
  const access = await requireLibraryAccess(orgSlug)
  if (!access.ok) return access

  const parsed = LibraryItemInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('library_items')
    .insert({ ...parsed.data, organization_id: access.org.id, source_module: 'library', created_by: access.user.id })
    .select('*')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, item: data as LibraryItem }
}

export async function updateLibraryItem(orgSlug: string, id: string, input: unknown): Promise<{ ok: true; item: LibraryItem } | { ok: false; error: string }> {
  const access = await requireLibraryAccess(orgSlug)
  if (!access.ok) return access

  const parsed = LibraryItemInput.partial().safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }
  if (Object.keys(parsed.data).length === 0) return { ok: false, error: 'Nada para atualizar.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('library_items')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('organization_id', access.org.id)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Item não encontrado.' }
  return { ok: true, item: data as LibraryItem }
}

export async function deleteLibraryItem(orgSlug: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireLibraryAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { error } = await supabase
    .from('library_items')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
