/**
 * Adapter Supabase Storage — existe só pra compatibilidade com os
 * arquivos já enviados antes da migração pro R2 (modelo híbrido, Fase 9
 * do plano). Não é usado para upload de arquivo NOVO — isso vai direto
 * pro adapter R2 (ver lib/storage/index.ts).
 *
 * Reaproveita createAdminClient() (service role), o mesmo client já
 * usado em todas as actions que hoje sobem arquivo pro Supabase Storage
 * — nenhuma credencial nova, nenhum comportamento novo pros buckets
 * legados.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type {
  StorageProviderAdapter, StorageObjectRef, UploadInput, UploadResult,
  SignedUrlOptions, ObjectMetadata,
} from '../types'
import { buildObjectKey } from '../types'

export const supabaseProvider: StorageProviderAdapter = {
  name: 'supabase',

  async upload(input: UploadInput): Promise<UploadResult> {
    // Suportado só pra manter a interface completa — na prática, todo
    // upload novo do Althos vai pro R2. Se algum caller cair aqui,
    // ainda funciona (mesmo client/bucket usados pelas actions legadas).
    const storageKey = buildObjectKey(input)
    const bucket = process.env.SUPABASE_STORAGE_FALLBACK_BUCKET || 'whatsapp-media'
    const admin = createAdminClient()
    const { error } = await admin.storage.from(bucket).upload(storageKey, input.body, {
      contentType: input.contentType,
      upsert: false,
    })
    if (error) throw new Error(error.message)
    return { provider: 'supabase', bucket, storageKey, size: input.body.byteLength }
  },

  async download(ref: StorageObjectRef): Promise<Buffer> {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from(ref.bucket).download(ref.storageKey)
    if (error || !data) throw new Error(error?.message || `Objeto não encontrado: ${ref.storageKey}`)
    return Buffer.from(await data.arrayBuffer())
  },

  async delete(ref: StorageObjectRef): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.storage.from(ref.bucket).remove([ref.storageKey])
    if (error) throw new Error(error.message)
  },

  async exists(ref: StorageObjectRef): Promise<boolean> {
    const admin = createAdminClient()
    const dir = ref.storageKey.split('/').slice(0, -1).join('/')
    const name = ref.storageKey.split('/').pop()!
    const { data, error } = await admin.storage.from(ref.bucket).list(dir, { search: name })
    if (error) throw new Error(error.message)
    return !!data?.some(f => f.name === name)
  },

  async getSignedUrl(ref: StorageObjectRef, opts: SignedUrlOptions): Promise<string> {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from(ref.bucket).createSignedUrl(
      ref.storageKey,
      opts.expiresInSeconds,
      opts.downloadFilename ? { download: opts.downloadFilename } : undefined,
    )
    if (error || !data) throw new Error(error?.message || 'Falha ao gerar signed URL')
    return data.signedUrl
  },

  async createUploadUrl() {
    // Supabase Storage suporta signed upload URL (createSignedUploadUrl),
    // mas isso não é necessário aqui: nenhum upload NOVO usa este
    // adapter (ver comentário no topo do arquivo). Deixado explícito em
    // vez de implementado silenciosamente errado.
    throw new Error('createUploadUrl não é suportado no adapter Supabase (legado) — uploads novos usam R2.')
  },

  async getMetadata(ref: StorageObjectRef): Promise<ObjectMetadata> {
    const admin = createAdminClient()
    const dir = ref.storageKey.split('/').slice(0, -1).join('/')
    const name = ref.storageKey.split('/').pop()!
    const { data, error } = await admin.storage.from(ref.bucket).list(dir, { search: name })
    if (error) throw new Error(error.message)
    const found = data?.find(f => f.name === name)
    if (!found) return { contentType: null, size: null, lastModified: null }
    return {
      contentType: (found.metadata as any)?.mimetype ?? null,
      size: (found.metadata as any)?.size ?? null,
      lastModified: found.updated_at ? new Date(found.updated_at) : null,
    }
  },
}
