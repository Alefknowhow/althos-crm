'use server'

/**
 * Biblioteca (issue #23) exposta no Portal do Cliente — extraído de
 * actions/client-portal-data.ts (que passou de 350 linhas). Mesmas regras
 * de segurança: admin client + filtro explícito por
 * access.organizationId/contatoId, nunca confiando em RLS sozinho (a
 * policy de library_assets é pensada pro membro interno, não pro usuário
 * externo do portal).
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePortalAccess } from '@/actions/client-portal'
import { StorageService } from '@/lib/storage'
import { MAX_UPLOAD_BYTES, ALLOWED_MIME_BY_CATEGORY } from '@/lib/storage/mime'
import { insertLibraryAssetVersion } from '@/lib/library/insert-asset'

export type PortalLibraryAsset = {
  id: string
  title: string
  description: string | null
  kind: 'bruto' | 'produzido'
  status: 'pendente' | 'aprovado' | 'alteracao_solicitada'
  publicToken: string | null
  version: number
  createdAt: string
  signedUrl: string | null
  mimeType: string | null
  width: number | null
  height: number | null
}

export type PortalLibraryAssetComment = {
  id: string
  authorType: 'team' | 'client'
  authorName: string | null
  body: string
  createdAt: string
}

export type PortalLibraryAssetChain = {
  rootAssetId: string
  latest: PortalLibraryAsset
  versions: PortalLibraryAsset[]
  comments: PortalLibraryAssetComment[]
}

function mapPortalAssetRow(row: any): PortalLibraryAsset {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    status: row.status,
    publicToken: row.public_token,
    version: row.version,
    createdAt: row.created_at,
    signedUrl: row.signed_url ?? null,
    mimeType: row.storage_objects?.mime_type ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
  }
}

/** Cadeias completas (versões + comentários), igual `listAssetChains` faz
 *  pro painel interno, mas via admin client. */
export async function listPortalLibraryAssetChains(contatoId: string): Promise<PortalLibraryAssetChain[]> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()

  const { data: assets } = await admin
    .from('library_assets')
    .select('id, root_asset_id, kind, version, title, description, status, public_token, created_at, width, height, storage_objects(mime_type, storage_provider, bucket, storage_key)')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
    .order('version', { ascending: false })

  if (!assets || assets.length === 0) return []

  const withSignedUrl = await Promise.all(assets.map(async (a: any) => {
    const obj = a.storage_objects
    let signedUrl: string | null = null
    if (obj?.storage_provider && obj?.bucket && obj?.storage_key) {
      try {
        signedUrl = await StorageService.getSignedUrl({ provider: obj.storage_provider, bucket: obj.bucket, storageKey: obj.storage_key })
      } catch { /* asset sem preview disponível — segue sem quebrar a lista */ }
    }
    return { ...a, signed_url: signedUrl }
  }))

  const assetIds = assets.map((a: any) => a.id)
  const { data: comments } = await admin
    .from('library_asset_comments')
    .select('id, asset_id, author_type, author_name, body, created_at')
    .in('asset_id', assetIds)
    .order('created_at', { ascending: true })

  const commentsByAsset = new Map<string, PortalLibraryAssetComment[]>()
  for (const c of comments || []) {
    const list = commentsByAsset.get(c.asset_id) || []
    list.push({ id: c.id, authorType: c.author_type, authorName: c.author_name, body: c.body, createdAt: c.created_at })
    commentsByAsset.set(c.asset_id, list)
  }

  const byRoot = new Map<string, any[]>()
  for (const a of withSignedUrl) {
    const list = byRoot.get(a.root_asset_id) || []
    list.push(a)
    byRoot.set(a.root_asset_id, list)
  }

  const chains: PortalLibraryAssetChain[] = []
  for (const [rootAssetId, versions] of Array.from(byRoot.entries())) {
    const sorted = versions.sort((a: any, b: any) => b.version - a.version)
    const latest = sorted[0]
    const allComments = sorted.flatMap((v: any) => commentsByAsset.get(v.id) || [])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    chains.push({ rootAssetId, latest: mapPortalAssetRow(latest), versions: sorted.map(mapPortalAssetRow), comments: allComments })
  }

  return chains.sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}

const PortalUploadSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  base64: z.string().min(1),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  parentAssetId: z.string().uuid().optional().nullable(),
})

/** Upload de material bruto pelo Portal do Cliente (issue #23 — "cliente
 *  pode enviar materiais brutos"). `kind` é sempre forçado 'bruto': o
 *  cliente nunca cria um item 'produzido' (isso é trabalho da agência).
 *  Sem sessão de membro — validação de MIME/tamanho replicada aqui
 *  (mesmas constantes de actions/storage-upload.ts) e upload direto via
 *  StorageService + admin client, já que `uploadFile` exige requireAuth. */
export async function uploadPortalLibraryAsset(contatoId: string, input: unknown) {
  const access = await requirePortalAccess(contatoId)
  const parsed = PortalUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const data = parsed.data

  if (!ALLOWED_MIME_BY_CATEGORY.library.includes(data.contentType)) {
    return { ok: false as const, error: `Tipo de arquivo não permitido: ${data.contentType}` }
  }
  const buffer = Buffer.from(data.base64, 'base64')
  if (buffer.byteLength === 0) return { ok: false as const, error: 'Arquivo vazio.' }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false as const, error: `Arquivo muito grande (máx ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` }
  }

  const admin = createAdminClient()

  if (data.parentAssetId) {
    const { data: parent } = await admin
      .from('library_assets').select('id, kind')
      .eq('id', data.parentAssetId).eq('organization_id', access.organizationId).eq('contato_id', contatoId)
      .maybeSingle()
    if (!parent) return { ok: false as const, error: 'Versão anterior não encontrada.' }
    if (parent.kind !== 'bruto') return { ok: false as const, error: 'Só é possível enviar nova versão de material bruto pelo portal.' }
  }

  let uploadResult
  try {
    uploadResult = await StorageService.upload({
      organizationId: access.organizationId,
      category: 'library',
      scopeId: contatoId,
      fileId: crypto.randomUUID(),
      body: buffer,
      contentType: data.contentType,
      filename: data.filename,
    })
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar arquivo.' }
  }

  const { data: registered, error: regError } = await admin
    .from('storage_objects')
    .insert({
      organization_id: access.organizationId,
      user_id: null,
      storage_provider: uploadResult.provider,
      bucket: uploadResult.bucket,
      storage_key: uploadResult.storageKey,
      filename: data.filename,
      mime_type: data.contentType,
      size_bytes: uploadResult.size,
      metadata: { uploaded_via: 'portal' },
    })
    .select('id')
    .single()
  if (regError || !registered) return { ok: false as const, error: regError?.message || 'Falha ao registrar arquivo.' }

  const insertResult = await insertLibraryAssetVersion(admin, {
    organizationId: access.organizationId,
    contatoId,
    kind: 'bruto',
    parentAssetId: data.parentAssetId || null,
    storageObjectId: registered.id,
    title: data.title,
    description: data.description,
    width: data.width,
    height: data.height,
    createdBy: null,
  })
  if (!insertResult.ok) return { ok: false as const, error: insertResult.error }

  try {
    await admin.from('contato_activities').insert({
      contato_id: contatoId,
      organization_id: access.organizationId,
      type: 'library_asset_uploaded_portal',
      payload: { asset_id: insertResult.id, title: data.title },
    })
  } catch { /* auditoria best-effort — nunca falha o upload por causa dela */ }

  return { ok: true as const, id: insertResult.id }
}

/** Comentário do cliente numa cadeia de asset, direto pelo Portal. */
export async function addPortalAssetComment(contatoId: string, assetId: string, body: string) {
  const access = await requirePortalAccess(contatoId)
  const text = body.trim()
  if (!text) return { ok: false as const, error: 'Comentário vazio.' }
  if (text.length > 2000) return { ok: false as const, error: 'Comentário muito longo.' }

  const admin = createAdminClient()
  const { data: asset } = await admin
    .from('library_assets').select('id')
    .eq('id', assetId).eq('organization_id', access.organizationId).eq('contato_id', contatoId)
    .maybeSingle()
  if (!asset) return { ok: false as const, error: 'Material não encontrado.' }

  const { error } = await admin.from('library_asset_comments').insert({
    organization_id: access.organizationId,
    asset_id: assetId,
    author_type: 'client',
    author_name: access.contatoName,
    user_id: null,
    body: text,
  })
  if (error) return { ok: false as const, error: error.message }

  try {
    await admin.from('contato_activities').insert({
      contato_id: contatoId, organization_id: access.organizationId,
      type: 'library_asset_commented_portal', payload: { asset_id: assetId },
    })
  } catch { /* best-effort */ }

  return { ok: true as const }
}

/** Aprovação/solicitação de alteração direto no Portal (sem precisar do
 *  link público) — mesma regra da RPC pública `update_public_library_asset_status`:
 *  só produzido+pendente, comentário obrigatório pra alteração. */
export async function respondPortalAsset(
  contatoId: string,
  assetId: string,
  status: 'aprovado' | 'alteracao_solicitada',
  comment: string | null,
) {
  const access = await requirePortalAccess(contatoId)
  if (status === 'alteracao_solicitada' && !comment?.trim()) {
    return { ok: false as const, error: 'Descreva o que precisa mudar.' }
  }

  const admin = createAdminClient()
  const { data: asset } = await admin
    .from('library_assets').select('id, kind, status')
    .eq('id', assetId).eq('organization_id', access.organizationId).eq('contato_id', contatoId)
    .maybeSingle()
  if (!asset) return { ok: false as const, error: 'Material não encontrado.' }
  if (asset.kind !== 'produzido' || asset.status !== 'pendente') {
    return { ok: false as const, error: 'Este material não está aguardando aprovação.' }
  }

  const { error } = await admin.from('library_assets').update({ status }).eq('id', assetId)
  if (error) return { ok: false as const, error: error.message }

  if (comment?.trim()) {
    await admin.from('library_asset_comments').insert({
      organization_id: access.organizationId,
      asset_id: assetId,
      author_type: 'client',
      author_name: access.contatoName,
      body: comment.trim(),
    })
  }

  try {
    await admin.from('contato_activities').insert({
      contato_id: contatoId,
      organization_id: access.organizationId,
      type: status === 'aprovado' ? 'library_asset_approved_portal' : 'library_asset_change_requested_portal',
      payload: { asset_id: assetId },
    })
  } catch { /* best-effort */ }

  return { ok: true as const }
}

/** Gera (ou reaproveita) o token público de aprovação de um asset a
 *  partir do portal — mesma lógica de generateAssetLink (painel interno),
 *  mas validada contra a membership do portal em vez da permissão
 *  'trafego'. Nunca gera token pra um asset de outro cliente. */
export async function getOrCreatePortalAssetLink(contatoId: string, assetId: string) {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data: asset } = await admin
    .from('library_assets').select('id, public_token')
    .eq('id', assetId).eq('organization_id', access.organizationId).eq('contato_id', contatoId)
    .maybeSingle()
  if (!asset) return { ok: false as const, error: 'Material não encontrado.' }

  if (asset.public_token) return { ok: true as const, token: asset.public_token }

  const token = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
  const { error } = await admin.from('library_assets').update({ public_token: token }).eq('id', assetId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, token }
}
