import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'

export const dynamic = 'force-dynamic'

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase F. O módulo "Marketing"
 * genérico (`/marketing`) já é uma tela real e completa de Tráfego: contas
 * de anúncio Meta Ads via OAuth, campanhas, métricas, drill-down por
 * conjunto/anúncio (`actions/marketing.ts`). Não duplicar — só redireciona
 * pra lá, mesma resolução que a Fase B já deu pra Vendas/Financeiro/etc.
 */
export default async function AgenciaTrafegoTrafegoPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)
  redirect(`/app/${params.orgSlug}/marketing`)
}
