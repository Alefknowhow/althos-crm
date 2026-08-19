/**
 * Storage Service — ponto único de entrada pro armazenamento de arquivo
 * no Althos. Nenhum outro módulo deve importar o SDK do R2 ou chamar
 * `supabase.storage` diretamente pra um caso de uso NOVO — isso é o que
 * permite trocar de provider (R2 → S3 → Backblaze B2 → outro) sem
 * reescrever o resto do produto (ver .harness/invariants.md § Storage).
 *
 * Uploads NOVOS sempre vão pro R2. Objetos com storage_provider =
 * 'supabase' (os buckets legados, criados antes desta migração)
 * continuam funcionando via o adapter Supabase — é o modelo híbrido da
 * Fase 9 do plano de migração.
 *
 * Este módulo só roda em server-side (Server Actions, route handlers) —
 * nunca em componente client. As credenciais do R2 nunca saem daqui.
 */

import type {
  StorageProviderName, StorageProviderAdapter, StorageObjectRef, UploadInput,
  UploadResult, SignedUrlOptions, ObjectMetadata, StorageCategory,
} from './types'
import { r2Provider, isR2Configured } from './providers/r2'
import { supabaseProvider } from './providers/supabase'

export type { StorageProviderName, StorageCategory, UploadInput, UploadResult, SignedUrlOptions, ObjectMetadata, StorageObjectRef }
export { buildObjectKey } from './types'

const PROVIDERS: Record<StorageProviderName, StorageProviderAdapter> = {
  r2: r2Provider,
  supabase: supabaseProvider,
  // s3/b2 ainda não têm adapter — quando existirem, registram aqui.
  // Referenciar um provider sem adapter falha alto (getProvider), nunca
  // silenciosamente.
  s3: r2Provider, // placeholder até existir um adapter S3 dedicado — nunca usado hoje (nenhum registro tem storage_provider='s3')
  b2: r2Provider, // idem, pra 'b2'
}

function getProvider(name: StorageProviderName): StorageProviderAdapter {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Provider de storage desconhecido: ${name}`)
  return p
}

/** Provider usado para todo upload NOVO. Hoje sempre 'r2' — centralizado
 *  aqui em vez de espalhado, pra trocar em um lugar só quando o próximo
 *  provider entrar. */
function defaultProviderForNewUploads(): StorageProviderName {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 não configurado neste ambiente — upload novo indisponível até as credenciais serem definidas.')
  }
  return 'r2'
}

export const StorageService = {
  /** Sobe um arquivo novo — sempre no provider atual (R2). Retorna o que
   *  precisa ser persistido em `storage_objects` (bucket/storage_key/provider). */
  async upload(input: UploadInput): Promise<UploadResult> {
    const provider = getProvider(defaultProviderForNewUploads())
    return provider.upload(input)
  },

  /** Baixa o conteúdo do objeto — despacha pro provider certo com base
   *  em `ref.provider` (é assim que o modelo híbrido funciona: um
   *  registro antigo com provider='supabase' busca no Supabase Storage,
   *  um novo com provider='r2' busca no R2). */
  async download(ref: StorageObjectRef): Promise<Buffer> {
    return getProvider(ref.provider).download(ref)
  },

  async delete(ref: StorageObjectRef): Promise<void> {
    return getProvider(ref.provider).delete(ref)
  },

  async exists(ref: StorageObjectRef): Promise<boolean> {
    return getProvider(ref.provider).exists(ref)
  },

  /** URL temporária de leitura — nunca uma URL pública permanente pra
   *  objeto privado (Fase 7 do plano). TTL default de 10min quando o
   *  caller não especifica (dentro da faixa 5–15min recomendada). */
  async getSignedUrl(ref: StorageObjectRef, opts?: Partial<SignedUrlOptions>): Promise<string> {
    return getProvider(ref.provider).getSignedUrl(ref, {
      expiresInSeconds: opts?.expiresInSeconds ?? 600,
      downloadFilename: opts?.downloadFilename ?? null,
    })
  },

  /** URL de upload direto do browser pro provider (Fase 6 — presigned
   *  upload), sem passar o arquivo pelo servidor da aplicação. Só pra
   *  upload NOVO, então sempre no provider atual. */
  async createUploadUrl(input: Omit<UploadInput, 'body'>, expiresInSeconds = 600) {
    const provider = getProvider(defaultProviderForNewUploads())
    return provider.createUploadUrl(input, expiresInSeconds)
  },

  async getMetadata(ref: StorageObjectRef): Promise<ObjectMetadata> {
    return getProvider(ref.provider).getMetadata(ref)
  },
}
