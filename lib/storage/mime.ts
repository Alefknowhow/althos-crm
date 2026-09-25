import type { StorageCategory } from '@/lib/storage'

/**
 * Limites/whitelist de upload por categoria — extraído de
 * actions/storage-upload.ts pra poder ser importado tanto por Server
 * Actions normais quanto pelas actions do Portal do Cliente
 * (actions/client-portal-data.ts), que fazem upload sem passar por
 * requireAuth(). Um arquivo 'use server' só pode exportar funções async
 * (constraint do Next.js), por isso essas constantes vivem aqui, fora
 * de qualquer arquivo 'use server'.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB — mesmo teto já usado pelos uploads existentes (whatsapp-media, instagram-media)

export const ALLOWED_MIME_BY_CATEGORY: Record<StorageCategory, string[]> = {
  whatsapp: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/webm', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'video/mp4', 'video/3gpp', 'application/pdf'],
  instagram: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac'],
  attachments: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  documents: ['application/pdf', 'image/jpeg', 'image/png'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  exports: ['text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  library: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'],
}
