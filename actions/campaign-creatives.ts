'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { uploadCreativeAsset } from '@/actions/upload'

/**
 * Vertical Agências de Tráfego — aprovação de criativo pelo cliente. Ver
 * supabase/migrations/0190_traffic_client_management.sql.
 */

export type Creative = {
  id: string
  contato_id: string
  campaign_id: string | null
  storage_key: string
  media_type: 'image' | 'video' | 'pdf'
  title: string
  description: string | null
  status: 'pendente' | 'aprovado' | 'reprovado'
  client_comment: string | null
  public_token: string | null
  created_at: string
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listCreatives(orgSlug: string, contatoId: string): Promise<Creative[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('campaign_creatives')
    .select('id, contato_id, campaign_id, storage_key, media_type, title, description, status, client_comment, public_token, created_at')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
  return (data as Creative[]) || []
}

const UploadSchema = z.object({
  contatoId: z.string().uuid(),
  campaignId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
})

export async function uploadCreative(orgSlug: string, formData: FormData) {
  const { org, user } = await requireAccess(orgSlug)

  const parsed = UploadSchema.safeParse({
    contatoId: formData.get('contatoId'),
    campaignId: formData.get('campaignId') || null,
    title: formData.get('title'),
    description: formData.get('description') || null,
  })
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const uploadResult = await uploadCreativeAsset(orgSlug, formData)
  if (!uploadResult.ok) return { ok: false as const, error: uploadResult.error }

  const supabase = createClient()
  const { error } = await supabase.from('campaign_creatives').insert({
    organization_id: org.id,
    contato_id: parsed.data.contatoId,
    campaign_id: parsed.data.campaignId || null,
    storage_key: uploadResult.url,
    media_type: uploadResult.mediaType,
    title: parsed.data.title,
    description: parsed.data.description || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function generateCreativeLink(orgSlug: string, id: string, rotate = false) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: c } = await supabase
    .from('campaign_creatives').select('id, public_token')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!c) return { ok: false as const, error: 'Criativo não encontrado' }

  const oldToken = c.public_token
  const token = rotate || !oldToken
    ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
    : oldToken

  const { error } = await supabase.from('campaign_creatives').update({ public_token: token }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, token }
}

/**
 * Resposta pública do cliente (aprovar/reprovar) — sem auth, chamada da
 * página `app/(public)/criativo/[token]/page.tsx`. Escreve exclusivamente
 * via a RPC security-definer `update_public_creative_status`, restrita a
 * status/comentário do registro do token — mesmo espírito de leitura
 * pública já usado em Cotações (get_public_quotation), mas de escrita.
 */
export async function respondToCreativePublic(token: string, status: 'aprovado' | 'reprovado', comment: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return { ok: false as const, error: 'Configuração ausente' }

  const res = await fetch(`${base}/rest/v1/rpc/update_public_creative_status`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_status: status, p_comment: comment || null }),
  })
  if (!res.ok) return { ok: false as const, error: 'Falha ao registrar resposta' }
  const success = await res.json()
  if (!success) return { ok: false as const, error: 'Link inválido ou expirado' }

  // Histórico do cliente (contato_activities, Core) — best-effort, nunca
  // bloqueia a resposta do cliente se a busca/gravação falhar.
  try {
    const admin = createAdminClient()
    const { data: creative } = await admin
      .from('campaign_creatives')
      .select('id, contato_id, organization_id, title')
      .eq('public_token', token)
      .maybeSingle()
    if (creative) {
      await admin.from('contato_activities').insert({
        contato_id: creative.contato_id,
        organization_id: creative.organization_id,
        type: 'traffic_creative_status_changed',
        payload: { title: creative.title, status, comment },
      })
    }
  } catch { /* best-effort */ }

  return { ok: true as const }
}

export async function deleteCreative(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('campaign_creatives').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
