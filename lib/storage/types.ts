/**
 * Contrato da Storage Service — o resto do Althos depende disso, nunca do
 * SDK do R2 (ou do client do Supabase Storage) diretamente. Trocar de
 * provider no futuro (S3, Backblaze B2, etc.) significa implementar
 * `StorageProviderAdapter` de novo, sem tocar em nenhum caller.
 *
 * Ver .harness/invariants.md e docs da migração pra R2 pro racional
 * completo (isolamento multi-tenant, modelo híbrido supabase/r2, etc.).
 */

export type StorageProviderName = 'supabase' | 'r2' | 's3' | 'b2'

/** Categorias de objeto — usadas pra montar a key e pra decidir limites
 *  de validação (Fase 14 do plano). Adicione uma categoria nova aqui
 *  antes de usá-la em `buildObjectKey`. */
export type StorageCategory =
  | 'whatsapp'
  | 'instagram'
  | 'attachments'
  | 'documents'
  | 'avatars'
  | 'exports'

export type UploadInput = {
  organizationId: string
  category: StorageCategory
  /** Sub-recurso opcional dentro da categoria (ex.: conversationId pro
   *  WhatsApp/Instagram) — vira mais um segmento da key. */
  scopeId?: string | null
  fileId: string
  body: Buffer | Uint8Array
  contentType: string
  filename?: string | null
}

export type UploadResult = {
  provider: StorageProviderName
  bucket: string
  storageKey: string
  size: number
}

export type SignedUrlOptions = {
  /** Segundos até expirar. Ver Fase 7 do plano: 5–15min pra imagem/documento. */
  expiresInSeconds: number
  /** Nome sugerido de download (Content-Disposition), quando aplicável. */
  downloadFilename?: string | null
}

export type ObjectMetadata = {
  contentType: string | null
  size: number | null
  lastModified: Date | null
}

/** Localização de um objeto já existente — o que basta pra download/
 *  delete/signed-url/metadata. Normalmente vem de uma linha de
 *  `storage_objects` (provider + bucket + storage_key). */
export type StorageObjectRef = {
  provider: StorageProviderName
  bucket: string
  storageKey: string
}

/** Interface que cada provider (R2, Supabase legado, futuro S3/B2)
 *  implementa. A StorageService (index.ts) despacha pra um destes com
 *  base em `provider`. */
export interface StorageProviderAdapter {
  readonly name: StorageProviderName
  upload(input: UploadInput): Promise<UploadResult>
  download(ref: StorageObjectRef): Promise<Buffer>
  delete(ref: StorageObjectRef): Promise<void>
  exists(ref: StorageObjectRef): Promise<boolean>
  getSignedUrl(ref: StorageObjectRef, opts: SignedUrlOptions): Promise<string>
  /** URL de upload direto do browser pro provider — Fase 6 (presigned
   *  upload). Pode não ser suportado por todo provider; nesse caso o
   *  adapter lança um erro claro em vez de fingir suporte. */
  createUploadUrl(input: Omit<UploadInput, 'body'>, expiresInSeconds: number): Promise<{ uploadUrl: string; bucket: string; storageKey: string }>
  getMetadata(ref: StorageObjectRef): Promise<ObjectMetadata>
}

/** Monta a key seguindo a estrutura recomendada na Fase 4 do plano:
 *  tenants/{tenantId}/{category}/{scopeId?}/{fileId} */
export function buildObjectKey(input: Pick<UploadInput, 'organizationId' | 'category' | 'scopeId' | 'fileId'>): string {
  const segments = ['tenants', input.organizationId, input.category]
  if (input.scopeId) segments.push(input.scopeId)
  segments.push(input.fileId)
  return segments.join('/')
}
