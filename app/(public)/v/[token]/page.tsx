import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicVitrineView from '@/components/features/showcase/PublicVitrineView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const supabase = createAdminClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('vitrine_token', params.token)
    .maybeSingle()
  const name = org?.name || 'Vitrine de viagens'
  return {
    title: `${name} — Pacotes de viagem`,
    description: 'Confira nossos pacotes de viagem disponíveis.',
    robots: { index: false, follow: false },
  }
}

export default async function PublicVitrinePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, cnpj, cadastur, contact_phone, contact_email, instagram, website')
    .eq('vitrine_token', params.token)
    .maybeSingle()

  if (!org) notFound()

  const { data: packages } = await supabase
    .from('travel_showcase_packages')
    .select('id, title, category, youtube_url, cover_photos, start_date, end_date, destinations, total_cents')
    .eq('organization_id', (org as any).id)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(500)

  return (
    <PublicVitrineView
      token={params.token}
      packages={(packages as any[]) || []}
      org={org as any}
    />
  )
}
