import { redirect } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import PlaceholderPage from '@/components/features/agencias-trafego/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function AgenciaTrafegoVendasPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  return (
    <PlaceholderPage
      icon={ShoppingCart}
      title="Nenhuma venda registrada ainda"
      description="As vendas geradas a partir das oportunidades dos clientes aparecem aqui assim que essa tela for especificada."
    />
  )
}
