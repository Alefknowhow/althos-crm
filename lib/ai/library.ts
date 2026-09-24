/**
 * Biblioteca / Agent Knowledge compartilhada (issue #50) — camada única de
 * leitura pra qualquer motor de IA que precise de conhecimento adicional da
 * org, no mesmo espírito de lib/ai/business-context.ts (#45): resolvida sob
 * demanda pelo caller, nunca duplicada dentro de cada agente.
 *
 * Deliberadamente NÃO substitui as bases isoladas que já existem
 * (ai_knowledge_items, roteirista_knowledge_items, sales-coach) — é uma
 * camada nova e aditiva (ver migration 0269_library_items.sql).
 */

export type LibraryItem = {
  id: string
  organization_id: string
  source_module: string
  category: string | null
  title: string
  content: string
  priority: number
  is_active: boolean
}

type MinimalSupabase = {
  from: (table: string) => any
}

/** Todos os itens ativos da org, do maior pro menor priority — sem
 *  paginação: biblioteca é conteúdo curado manualmente, não um dataset
 *  grande (mesma premissa de ai_knowledge_items hoje). */
export async function getActiveLibraryItems(supabase: MinimalSupabase, organizationId: string): Promise<LibraryItem[]> {
  const { data } = await supabase
    .from('library_items')
    .select('id, organization_id, source_module, category, title, content, priority, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
  return (data ?? []) as LibraryItem[]
}

/** Converte pro formato que lib/ai/attendant-engine-core.ts::buildSystemBlocks()
 *  já sabe renderizar (agrupado por categoria) — reaproveita o mesmo bloco
 *  "# Base de conhecimento" que hoje só recebe ai_knowledge_items. */
export function libraryItemsToKnowledgeBase(items: LibraryItem[]): Array<{ category?: string | null; question: string; answer: string }> {
  return items.map(item => ({ category: item.category, question: item.title, answer: item.content }))
}
