import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicProposalView from '@/components/features/proposals/PublicProposalView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const supabase = createAdminClient()
  const { data: proposal } = await supabase
    .from('travel_proposals')
    .select('title, client_name')
    .eq('public_token', params.token)
    .maybeSingle()
  const title = proposal?.title || 'Proposta de viagem'
  return {
    title,
    description: proposal?.client_name ? `Proposta de viagem para ${proposal.client_name}` : 'Proposta de viagem personalizada',
    robots: { index: false, follow: false },
  }
}

export default async function PublicProposalPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()

  const { data: proposal } = await supabase
    .from('travel_proposals')
    .select('*')
    .eq('public_token', params.token)
    .maybeSingle()

  if (!proposal) notFound()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, cnpj, cadastur, contact_phone, contact_email, address_street, address_city, address_state, address_zip')
    .eq('id', proposal.organization_id)
    .maybeSingle()

  return <PublicProposalView proposal={proposal as any} org={(org as any) || {}} />
}
