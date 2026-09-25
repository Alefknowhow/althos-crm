'use server'

import { StorageService } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Fluxo público de aprovação da Biblioteca de Tráfego (issue #23) — sem
 * login, via public_token. Leitura/escrita passam por RPCs security-
 * definer restritas ao próprio registro do token (ver
 * supabase/migrations/0282_library_assets.sql), mesmo espírito de
 * get_public_creative/update_public_creative_status (0190). A URL de
 * leitura do arquivo é assinada aqui (server-side, via StorageService) —
 * nunca uma URL pública permanente.
 */

export type PublicLibraryAsset = {
  id: string
  title: string
  description: string | null
  kind: 'bruto' | 'produzido'
  status: 'pendente' | 'aprovado' | 'alteracao_solicitada'
  version: number
  createdAt: string
  mimeType: string | null
  filename: string | null
  width: number | null
  height: number | null
  signedUrl: string | null
  comments: { id: string; authorType: 'team' | 'client'; authorName: string | null; body: string; createdAt: string }[]
}

export async function getPublicLibraryAsset(token: string): Promise<PublicLibraryAsset | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null

  const res = await fetch(`${base}/rest/v1/rpc/get_public_library_asset`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || typeof data !== 'object') return null

  let signedUrl: string | null = null
  if (data.storageProvider && data.bucket && data.storageKey) {
    try {
      signedUrl = await StorageService.getSignedUrl(
        { provider: data.storageProvider, bucket: data.bucket, storageKey: data.storageKey },
        { downloadFilename: data.filename ?? undefined },
      )
    } catch { /* segue sem preview se a assinatura falhar */ }
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description ?? null,
    kind: data.kind,
    status: data.status,
    version: data.version,
    createdAt: data.createdAt,
    mimeType: data.mimeType ?? null,
    filename: data.filename ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
    signedUrl,
    comments: data.comments || [],
  }
}

export async function respondToLibraryAssetPublic(
  token: string,
  status: 'aprovado' | 'alteracao_solicitada',
  comment: string | null,
) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return { ok: false as const, error: 'Configuração ausente' }

  const res = await fetch(`${base}/rest/v1/rpc/update_public_library_asset_status`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_status: status, p_comment: comment || null }),
  })
  if (!res.ok) return { ok: false as const, error: 'Falha ao registrar resposta' }
  const success = await res.json()
  if (!success) return { ok: false as const, error: 'Link inválido ou expirado' }

  // Histórico do cliente (contato_activities) e evento de automação —
  // best-effort, nunca bloqueia a resposta do cliente se a busca/gravação
  // falhar. A RPC acima não devolve org/contato, então buscamos aqui pelo
  // próprio token (mesmo padrão de actions/campaign-creatives.ts::respondToCreativePublic).
  try {
    const admin = createAdminClient()
    const { data: asset } = await admin
      .from('library_assets')
      .select('id, contato_id, organization_id, title')
      .eq('public_token', token)
      .maybeSingle()
    if (asset) {
      await admin.from('contato_activities').insert({
        contato_id: asset.contato_id,
        organization_id: asset.organization_id,
        type: status === 'aprovado' ? 'library_asset_approved_public' : 'library_asset_change_requested_public',
        payload: { asset_id: asset.id, title: asset.title, comment },
      })

      const { inngest } = await import('@/lib/inngest/client')
      await inngest.send({
        name: status === 'aprovado' ? 'trafego.library.approved' : 'trafego.library.change_requested',
        data: { orgId: asset.organization_id, leadId: asset.contato_id, assetId: asset.id },
      })
    }
  } catch { /* best-effort */ }

  return { ok: true as const }
}
