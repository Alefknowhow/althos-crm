import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/supabase/types'
import { StorageService, buildObjectKey } from '@/lib/storage'
import { isR2Configured } from '@/lib/storage/providers/r2'

/**
 * Diagnóstico temporário da conexão com o Cloudflare R2 — restrito a
 * super-admin. Sobe um arquivo pequeno de teste, gera uma signed URL,
 * baixa de volta pra confirmar integridade, e apaga em seguida. Não
 * registra nada em `storage_objects` (é só um teste de conectividade,
 * não um upload real).
 *
 * Remover esta rota depois que a migração pra R2 estiver validada em
 * produção — ela não faz parte da Storage Service em si, é só uma
 * ferramenta de verificação pontual (Fase 21 do plano: "realizar teste
 * real de upload/download").
 */
export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!isR2Configured()) {
    return NextResponse.json({
      ok: false,
      error: 'R2 não configurado neste ambiente — faltam R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME.',
    }, { status: 200 })
  }

  const steps: Record<string, string> = {}
  const testOrgId = 'healthcheck'
  const fileId = `probe-${Date.now()}`
  const key = buildObjectKey({ organizationId: testOrgId, category: 'exports', fileId })
  const payload = Buffer.from(`Althos R2 healthcheck — ${new Date().toISOString()}`, 'utf8')

  try {
    const uploaded = await StorageService.upload({
      organizationId: testOrgId,
      category: 'exports',
      fileId,
      body: payload,
      contentType: 'text/plain',
      filename: 'healthcheck.txt',
    })
    steps.upload = `ok (bucket=${uploaded.bucket}, key=${uploaded.storageKey}, size=${uploaded.size})`

    const ref = { provider: uploaded.provider, bucket: uploaded.bucket, storageKey: uploaded.storageKey }

    const exists = await StorageService.exists(ref)
    steps.exists = exists ? 'ok (encontrado)' : 'FALHOU (não encontrado logo após upload)'

    const signedUrl = await StorageService.getSignedUrl(ref, { expiresInSeconds: 120 })
    steps.signedUrl = 'ok (gerada, não exibida no log)'

    const downloaded = await StorageService.download(ref)
    const matches = downloaded.equals(payload)
    steps.download = matches ? 'ok (conteúdo confere)' : 'FALHOU (conteúdo divergente)'

    // Confirma que a signed URL realmente funciona via HTTP, não só que a
    // chamada ao SDK não deu erro.
    const httpRes = await fetch(signedUrl)
    steps.signedUrlHttp = httpRes.ok ? `ok (status ${httpRes.status})` : `FALHOU (status ${httpRes.status})`

    await StorageService.delete(ref)
    const existsAfterDelete = await StorageService.exists(ref)
    steps.delete = existsAfterDelete ? 'FALHOU (ainda existe após delete)' : 'ok (removido)'

    const allOk = Object.values(steps).every(v => v.startsWith('ok'))
    return NextResponse.json({ ok: allOk, steps })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado', steps }, { status: 200 })
  }
}
