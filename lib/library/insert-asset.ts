/**
 * Núcleo de inserção de uma versão de `library_assets` — calcula
 * version/root_asset_id e insere, sem depender de sessão de membro
 * interno (recebe o client Supabase já pronto). Usado tanto por
 * `actions/library-assets.ts::uploadLibraryAsset` (painel interno, client
 * de sessão) quanto por `actions/client-portal-data.ts::uploadPortalLibraryAsset`
 * (Portal do Cliente, admin client) — evita duplicar a lógica de
 * versionamento/encadeamento nos dois lugares.
 */

export type InsertLibraryAssetInput = {
  organizationId: string
  contatoId: string
  campaignId?: string | null
  kind: 'bruto' | 'produzido'
  parentAssetId?: string | null
  storageObjectId: string
  title: string
  description?: string | null
  width?: number | null
  height?: number | null
  createdBy?: string | null
}

type SupabaseLike = {
  from: (table: string) => any
}

export async function insertLibraryAssetVersion(
  supabase: SupabaseLike,
  input: InsertLibraryAssetInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let rootAssetId: string | null = null
  let nextVersion = 1

  if (input.parentAssetId) {
    const { data: parent } = await supabase
      .from('library_assets')
      .select('id, root_asset_id, version')
      .eq('id', input.parentAssetId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()
    if (!parent) return { ok: false, error: 'Versão anterior não encontrada.' }
    rootAssetId = parent.root_asset_id
    nextVersion = parent.version + 1
  }

  const { data: inserted, error } = await supabase
    .from('library_assets')
    .insert({
      organization_id: input.organizationId,
      contato_id: input.contatoId,
      campaign_id: input.campaignId || null,
      kind: input.kind,
      parent_asset_id: input.parentAssetId || null,
      version: nextVersion,
      storage_object_id: input.storageObjectId,
      title: input.title,
      description: input.description || null,
      width: input.width || null,
      height: input.height || null,
      created_by: input.createdBy || null,
    })
    .select('id')
    .single()
  if (error || !inserted) return { ok: false, error: error?.message || 'Falha ao salvar asset.' }

  // v1 aponta root_asset_id pra ela mesma — permite agrupar toda a cadeia
  // com uma única query por root_asset_id (ver listAssetChains).
  const finalRootId = rootAssetId || inserted.id
  await supabase.from('library_assets').update({ root_asset_id: finalRootId }).eq('id', inserted.id)

  return { ok: true, id: inserted.id }
}
