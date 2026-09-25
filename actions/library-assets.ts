'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { uploadFile } from '@/actions/storage-upload'
import { StorageService } from '@/lib/storage'
import { getResend, clientEmailFrom } from '@/lib/resend'

/**
 * Biblioteca de Tráfego (issue #23) — materiais brutos e criativos
 * produzidos, com versionamento e comentários em thread. Ver
 * supabase/migrations/0282_library_assets.sql. Separado de
 * campaign_creatives (fluxo simples já em produção, não tocado aqui).
 */

export type LibraryAssetComment = {
  id: string
  authorType: 'team' | 'client'
  authorName: string | null
  body: string
  createdAt: string
}

export type LibraryAsset = {
  id: string
  contatoId: string
  campaignId: string | null
  kind: 'bruto' | 'produzido'
  rootAssetId: string
  parentAssetId: string | null
  version: number
  title: string
  description: string | null
  status: 'pendente' | 'aprovado' | 'alteracao_solicitada'
  publicToken: string | null
  createdAt: string
  signedUrl: string | null
  mimeType: string | null
}

/** Uma cadeia de versões — a mais recente primeiro, histórico completo em `versions`. */
export type LibraryAssetChain = {
  rootAssetId: string
  latest: LibraryAsset
  versions: LibraryAsset[]
  comments: LibraryAssetComment[]
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function mapRow(row: any): LibraryAsset {
  return {
    id: row.id,
    contatoId: row.contato_id,
    campaignId: row.campaign_id,
    kind: row.kind,
    rootAssetId: row.root_asset_id,
    parentAssetId: row.parent_asset_id,
    version: row.version,
    title: row.title,
    description: row.description,
    status: row.status,
    publicToken: row.public_token,
    createdAt: row.created_at,
    signedUrl: row.signed_url ?? null,
    mimeType: row.storage_objects?.mime_type ?? null,
  }
}

export async function listAssetChains(orgSlug: string, contatoId: string): Promise<LibraryAssetChain[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: assets } = await supabase
    .from('library_assets')
    .select('id, contato_id, campaign_id, kind, root_asset_id, parent_asset_id, version, title, description, status, public_token, created_at, storage_object_id, storage_objects(mime_type, storage_provider, bucket, storage_key)')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('version', { ascending: false })

  if (!assets || assets.length === 0) return []

  // Assina uma URL de leitura temporária por asset (sempre server-side,
  // nunca uma URL pública permanente) — mesmo padrão do resto do Storage.
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
  const { data: comments } = await supabase
    .from('library_asset_comments')
    .select('id, asset_id, author_type, author_name, body, created_at')
    .in('asset_id', assetIds)
    .order('created_at', { ascending: true })

  const commentsByAsset = new Map<string, LibraryAssetComment[]>()
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

  const chains: LibraryAssetChain[] = []
  for (const [rootAssetId, versions] of Array.from(byRoot.entries())) {
    const sorted = versions.sort((a: any, b: any) => b.version - a.version)
    const latest = sorted[0]
    const allComments = sorted.flatMap((v: any) => commentsByAsset.get(v.id) || [])
      .sort((a: LibraryAssetComment, b: LibraryAssetComment) => a.createdAt.localeCompare(b.createdAt))
    chains.push({
      rootAssetId,
      latest: mapRow(latest),
      versions: sorted.map(mapRow),
      comments: allComments,
    })
  }

  return chains.sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}

const UploadSchema = z.object({
  contatoId: z.string().uuid(),
  campaignId: z.string().uuid().optional().nullable(),
  kind: z.enum(['bruto', 'produzido']),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  /** Presente quando o upload é uma nova versão de um asset existente. */
  parentAssetId: z.string().uuid().optional().nullable(),
})

/**
 * Cria um asset novo (v1) ou uma nova versão de um asset existente
 * (nunca sobrescreve/apaga a versão anterior — cada upload é uma linha
 * nova em library_assets, encadeada por parent_asset_id/root_asset_id).
 */
export async function uploadLibraryAsset(
  orgSlug: string,
  input: {
    contatoId: string
    campaignId?: string | null
    kind: 'bruto' | 'produzido'
    title: string
    description?: string | null
    parentAssetId?: string | null
    filename: string
    contentType: string
    base64: string
  },
) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = UploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()

  let rootAssetId: string | null = null
  let nextVersion = 1
  if (parsed.data.parentAssetId) {
    const { data: parent } = await supabase
      .from('library_assets')
      .select('id, root_asset_id, version')
      .eq('id', parsed.data.parentAssetId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (!parent) return { ok: false as const, error: 'Versão anterior não encontrada.' }
    rootAssetId = parent.root_asset_id
    nextVersion = parent.version + 1
  }

  const uploadResult = await uploadFile(orgSlug, {
    category: 'library',
    scopeId: parsed.data.contatoId,
    filename: input.filename,
    contentType: input.contentType,
    base64: input.base64,
  })
  if (!uploadResult.ok) return { ok: false as const, error: uploadResult.error }

  const { data: inserted, error } = await supabase
    .from('library_assets')
    .insert({
      organization_id: org.id,
      contato_id: parsed.data.contatoId,
      campaign_id: parsed.data.campaignId || null,
      kind: parsed.data.kind,
      parent_asset_id: parsed.data.parentAssetId || null,
      version: nextVersion,
      storage_object_id: uploadResult.objectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !inserted) return { ok: false as const, error: error?.message || 'Falha ao salvar asset.' }

  // v1 aponta root_asset_id pra ela mesma — permite agrupar toda a cadeia
  // com uma única query por root_asset_id (ver listAssetChains).
  if (!rootAssetId) {
    rootAssetId = inserted.id
    await supabase.from('library_assets').update({ root_asset_id: rootAssetId }).eq('id', inserted.id)
  } else {
    await supabase.from('library_assets').update({ root_asset_id: rootAssetId }).eq('id', inserted.id)
  }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${parsed.data.contatoId}`)
  return { ok: true as const, id: inserted.id }
}

export async function addAssetComment(orgSlug: string, assetId: string, body: string) {
  const { org, user } = await requireAccess(orgSlug)
  const text = body.trim()
  if (!text) return { ok: false as const, error: 'Comentário vazio.' }
  if (text.length > 2000) return { ok: false as const, error: 'Comentário muito longo.' }

  const supabase = createClient()
  const { data: asset } = await supabase
    .from('library_assets').select('id, contato_id').eq('id', assetId).eq('organization_id', org.id).maybeSingle()
  if (!asset) return { ok: false as const, error: 'Asset não encontrado.' }

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()

  const { error } = await supabase.from('library_asset_comments').insert({
    organization_id: org.id,
    asset_id: assetId,
    author_type: 'team',
    author_name: profile?.name || null,
    user_id: user.id,
    body: text,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${asset.contato_id}`)
  return { ok: true as const }
}

export async function generateAssetLink(orgSlug: string, id: string, rotate = false) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: a } = await supabase
    .from('library_assets').select('id, public_token, contato_id')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!a) return { ok: false as const, error: 'Asset não encontrado' }

  const oldToken = a.public_token
  const token = rotate || !oldToken
    ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
    : oldToken

  const { error } = await supabase.from('library_assets').update({ public_token: token }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${a.contato_id}`)
  return { ok: true as const, token }
}

/** Reenvia o link de aprovação por e-mail — gera o token se ainda não
 *  existir (mesmo helper de generateAssetLink), issue #23 item 4. */
export async function sendAssetLinkByEmail(orgSlug: string, assetId: string, toEmail: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: asset } = await supabase
    .from('library_assets').select('id, title, public_token')
    .eq('id', assetId).eq('organization_id', org.id).maybeSingle()
  if (!asset) return { ok: false as const, error: 'Material não encontrado.' }

  let token = asset.public_token
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
    const { error } = await supabase.from('library_assets').update({ public_token: token }).eq('id', assetId)
    if (error) return { ok: false as const, error: error.message }
  }

  const link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.althoscrm.com.br'}/biblioteca/${token}`
  try {
    await getResend().emails.send({
      from: clientEmailFrom(org.name),
      to: toEmail,
      subject: `Aprovação — ${asset.title}`,
      html: `<p>Olá! Segue o link para revisar e aprovar "${asset.title}":</p><p><a href="${link}">${link}</a></p>`,
    })
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao enviar e-mail.' }
  }
}

/** Só apaga a versão mais recente de uma cadeia (nunca uma versão do meio,
 *  pra não quebrar o encadeamento parent_asset_id). */
export async function deleteLatestAssetVersion(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: a } = await supabase
    .from('library_assets').select('id, contato_id, root_asset_id, version')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!a) return { ok: false as const, error: 'Asset não encontrado' }

  const { data: newer } = await supabase
    .from('library_assets').select('id')
    .eq('root_asset_id', a.root_asset_id).gt('version', a.version).limit(1)
  if (newer && newer.length > 0) return { ok: false as const, error: 'Só é possível remover a versão mais recente.' }

  const { error } = await supabase.from('library_assets').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${a.contato_id}`)
  return { ok: true as const }
}
