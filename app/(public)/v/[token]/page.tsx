import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicVitrineStorefront, { type VitrineData } from '@/components/features/showcase/PublicVitrineStorefront'

export const revalidate = 300

async function fetchVitrine(token: string): Promise<VitrineData | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null
  const res = await fetch(
    `${base}/rest/v1/rpc/get_public_vitrine?p_vitrine_token=${encodeURIComponent(token)}`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, next: { tags: [`vitrine:${token}`], revalidate: 300 } },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data && typeof data === 'object' ? (data as VitrineData) : null
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const v = await fetchVitrine(params.token)
  const name = v?.org?.legal_name || 'Vitrine de viagens'
  return {
    title: `${name} — Pacotes de viagem`,
    description: 'Confira nossos pacotes de viagem disponíveis.',
    robots: { index: false, follow: false },
  }
}

export default async function PublicVitrinePage({ params }: { params: { token: string } }) {
  const v = await fetchVitrine(params.token)
  if (!v) notFound()
  return <PublicVitrineStorefront data={v} />
}
