'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Links de rastreamento próprios (Fase 1 do sistema de tracking) — ver
 * plano em C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md. CRUD de
 * `tracking_links`; o registro do clique em si acontece em app/r/[code]/route.ts.
 */

export type TrackingLink = {
  id: string
  code: string
  destination_url: string
  campaign_id: string | null
  contato_id: string | null
  label: string | null
  created_at: string
  clicks_count: number
}

function generateCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listTrackingLinksByClient(orgSlug: string, contatoId: string): Promise<TrackingLink[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('tracking_links')
    .select('id, code, destination_url, campaign_id, contato_id, label, created_at, clicks_count')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
  return (data as TrackingLink[]) || []
}

const CreateSchema = z.object({
  destinationUrl: z.string().url('URL de destino inválida'),
  label: z.string().max(160).optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
})

export async function createTrackingLink(orgSlug: string, contatoId: string, raw: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = CreateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const supabase = createClient()
  // Colisão de code é praticamente impossível (6 bytes aleatórios), mas
  // tenta de novo 1x se acontecer em vez de falhar pro usuário.
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('tracking_links')
      .insert({
        organization_id: org.id,
        contato_id: contatoId,
        code,
        destination_url: parsed.data.destinationUrl,
        label: parsed.data.label || null,
        campaign_id: parsed.data.campaignId || null,
        created_by: user.id,
      })
      .select('id, code, destination_url, campaign_id, contato_id, label, created_at, clicks_count')
      .single()
    if (!error) {
      revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${contatoId}`)
      return { ok: true as const, link: data as TrackingLink }
    }
    if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
      return { ok: false as const, error: error.message }
    }
  }
  return { ok: false as const, error: 'Falha ao gerar um código único, tente novamente' }
}

export async function deleteTrackingLink(orgSlug: string, id: string, contatoId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('tracking_links').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${contatoId}`)
  return { ok: true as const }
}
