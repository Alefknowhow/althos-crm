'use server'

import { StorageService } from '@/lib/storage'

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

  return { ok: true as const }
}
