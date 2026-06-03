import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicPackageView from '@/components/features/showcase/PublicPackageView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string; id: string } }): Promise<Metadata> {
  const supabase = createAdminClient()
  const { data: pkg } = await supabase
    .from('travel_showcase_packages')
    .select('title')
    .eq('id', params.id)
    .maybeSingle()
  return {
    title: pkg?.title || 'Pacote de viagem',
    description: 'Detalhes do pacote de viagem.',
    robots: { index: false, follow: false },
  }
}

export default async function PublicPackagePage({ params }: { params: { token: string; id: string } }) {
  const supabase = createAdminClient()

  // resolve a org pelo token da vitrine (garante que o pacote pertence a essa org)
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, cnpj, cadastur, contact_phone, contact_email, instagram, website, address_street, address_city, address_state, address_zip')
    .eq('vitrine_token', params.token)
    .maybeSingle()

  if (!org) notFound()

  const { data: pkg } = await supabase
    .from('travel_showcase_packages')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', (org as any).id)
    .eq('is_published', true)
    .maybeSingle()

  if (!pkg) notFound()

  return <PublicPackageView pkg={pkg as any} org={org as any} backHref={`/v/${params.token}`} />
}
