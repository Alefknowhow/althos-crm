/**
 * Cliente S3/R2 SEPARADO do de produção (lib/storage/providers/r2.ts) —
 * aponta pro bucket de backup (`R2_BACKUP_BUCKET_NAME`), com credenciais
 * próprias (`R2_BACKUP_ACCESS_KEY_ID`/`R2_BACKUP_SECRET_ACCESS_KEY`),
 * nunca as de produção. Isso é o que garante least privilege real: o
 * código normal da aplicação (Server Actions, webhooks) nunca importa
 * este arquivo, só os jobs de backup (lib/inngest/backup-cron.ts) e o
 * dashboard read-only (actions/backup.ts).
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

export function isBackupR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_BACKUP_ACCESS_KEY_ID &&
    process.env.R2_BACKUP_SECRET_ACCESS_KEY &&
    process.env.R2_BACKUP_BUCKET_NAME
  )
}

let cachedClient: S3Client | null = null

function resolveEndpoint(): string {
  if (process.env.R2_BACKUP_ENDPOINT) return process.env.R2_BACKUP_ENDPOINT
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}

function client(): S3Client {
  if (cachedClient) return cachedClient
  if (!isBackupR2Configured()) {
    throw new Error('Bucket de backup R2 não configurado (faltam R2_ACCOUNT_ID/R2_BACKUP_ACCESS_KEY_ID/R2_BACKUP_SECRET_ACCESS_KEY/R2_BACKUP_BUCKET_NAME).')
  }
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: resolveEndpoint(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_BACKUP_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_BACKUP_SECRET_ACCESS_KEY!,
    },
  })
  return cachedClient
}

export function backupBucketName(): string {
  const b = process.env.R2_BACKUP_BUCKET_NAME
  if (!b) throw new Error('R2_BACKUP_BUCKET_NAME não configurado.')
  return b
}

export async function putBackupObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: backupBucketName(), Key: key, Body: body, ContentType: contentType }))
}

export async function getBackupObject(key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: backupBucketName(), Key: key }))
  const bytes = await res.Body?.transformToByteArray()
  if (!bytes) throw new Error(`Objeto de backup vazio ou não encontrado: ${key}`)
  return Buffer.from(bytes)
}

export async function headBackupObject(key: string): Promise<{ etag: string | null; size: number | null } | null> {
  try {
    const res = await client().send(new HeadObjectCommand({ Bucket: backupBucketName(), Key: key }))
    return { etag: res.ETag ?? null, size: res.ContentLength ?? null }
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return null
    throw e
  }
}

/** Lista todas as keys sob um prefixo — pagina até acabar. Usado pela
 *  retenção (percorre database/{tier}/ e manifests/{tier}/). */
export async function listBackupObjects(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await client().send(new ListObjectsV2Command({
      Bucket: backupBucketName(),
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key)
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

export async function deleteBackupObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: backupBucketName(), Key: key }))
}
