/**
 * Adapter Cloudflare R2 — API compatível com S3, via @aws-sdk/client-s3.
 * Único lugar do projeto que importa o SDK do S3/R2 diretamente; tudo
 * mais fala com `StorageProviderAdapter` (ver lib/storage/types.ts).
 *
 * Credenciais só existem aqui, lidas de process.env, nunca hardcoded e
 * nunca expostas ao client (este arquivo só roda em código server-side —
 * Server Actions, route handlers).
 */

import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  StorageProviderAdapter, StorageObjectRef, UploadInput, UploadResult,
  SignedUrlOptions, ObjectMetadata,
} from '../types'
import { buildObjectKey } from '../types'

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

let cachedClient: S3Client | null = null

/** R2_ENDPOINT é opcional — se ausente, monta o endpoint padrão a partir
 *  do account ID (https://{accountId}.r2.cloudflarestorage.com), que é
 *  o formato documentado pela Cloudflare. */
function resolveEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}

function client(): S3Client {
  if (cachedClient) return cachedClient
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 não configurado (faltam R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME).')
  }
  cachedClient = new S3Client({
    region: 'auto', // R2 não usa regiões AWS reais — 'auto' é o valor documentado pela Cloudflare.
    endpoint: resolveEndpoint(),
    // Path-style (endpoint/bucket/key) em vez de virtual-hosted-style
    // (bucket.endpoint/key) — recomendação da Cloudflare pro R2. Sem isso o
    // SDK gera URLs em bucket.{accountId}.r2.cloudflarestorage.com, um host
    // que não bate com o domínio fixo liberado no CSP (next.config.mjs).
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  return cachedClient
}

function bucketName(): string {
  const b = process.env.R2_BUCKET_NAME
  if (!b) throw new Error('R2_BUCKET_NAME não configurado.')
  return b
}

/** Monta um Content-Disposition seguro pra ir num header HTTP assinado
 *  (SigV4) — headers HTTP só aceitam ASCII/Latin-1; um nome de arquivo
 *  com acento (ex.: "cotação.pdf") faz o Node reescrever o valor real na
 *  hora de enviar, o que não bate mais com o que o SDK assinou —
 *  resultado: "The request signature we calculated does not match"
 *  (erro visto ao anexar PDF com nome acentuado; imagem com nome sem
 *  acento passava batido). `filename` (entre aspas) vira uma versão só
 *  ASCII pra compatibilidade; `filename*` (RFC 5987, percent-encoded)
 *  carrega o nome de verdade — todo navegador moderno prioriza esse
 *  campo, então o nome exibido no download continua correto. */
function buildContentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
  const encoded = encodeURIComponent(filename)
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encoded}`
}

export const r2Provider: StorageProviderAdapter = {
  name: 'r2',

  async upload(input: UploadInput): Promise<UploadResult> {
    const storageKey = buildObjectKey(input)
    const bucket = bucketName()
    await client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: input.body,
      ContentType: input.contentType,
      ...(input.filename ? { ContentDisposition: buildContentDisposition('inline', input.filename) } : {}),
    }))
    return { provider: 'r2', bucket, storageKey, size: input.body.byteLength }
  },

  async download(ref: StorageObjectRef): Promise<Buffer> {
    const res = await client().send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }))
    const bytes = await res.Body?.transformToByteArray()
    if (!bytes) throw new Error(`Objeto vazio ou não encontrado: ${ref.storageKey}`)
    return Buffer.from(bytes)
  },

  async delete(ref: StorageObjectRef): Promise<void> {
    await client().send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }))
  },

  async exists(ref: StorageObjectRef): Promise<boolean> {
    try {
      await client().send(new HeadObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }))
      return true
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false
      throw e
    }
  },

  async getSignedUrl(ref: StorageObjectRef, opts: SignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.storageKey,
      ...(opts.downloadFilename
        ? { ResponseContentDisposition: buildContentDisposition('attachment', opts.downloadFilename) }
        : {}),
    })
    return getS3SignedUrl(client(), command, { expiresIn: opts.expiresInSeconds })
  },

  async createUploadUrl(input, expiresInSeconds) {
    const storageKey = buildObjectKey(input)
    const bucket = bucketName()
    const command = new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: input.contentType })
    const uploadUrl = await getS3SignedUrl(client(), command, { expiresIn: expiresInSeconds })
    return { uploadUrl, bucket, storageKey }
  },

  async getMetadata(ref: StorageObjectRef): Promise<ObjectMetadata> {
    const res = await client().send(new HeadObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }))
    return {
      contentType: res.ContentType ?? null,
      size: res.ContentLength ?? null,
      lastModified: res.LastModified ?? null,
    }
  },
}
