import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicCreativeApprovalView, { type PublicCreative } from '@/components/features/agencias-trafego/PublicCreativeApprovalView'

/**
 * Aprovação pública de criativo (Vertical Agências de Tráfego). Leitura
 * exclusivamente pela RPC security-definer get_public_creative (anon key) —
 * mesmo padrão de app/(public)/p/[token]/page.tsx pra cotações.
 */

export const revalidate = 0

async function fetchCreative(token: string): Promise<PublicCreative | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null
  const res = await fetch(
    `${base}/rest/v1/rpc/get_public_creative?p_token=${encodeURIComponent(token)}`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: 'no-store' },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data && typeof data === 'object' ? (data as PublicCreative) : null
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const c = await fetchCreative(params.token)
  return { title: c ? `Aprovação — ${c.title}` : 'Criativo não encontrado' }
}

export default async function CreativeApprovalPage({ params }: { params: { token: string } }) {
  const creative = await fetchCreative(params.token)
  if (!creative) notFound()
  return <PublicCreativeApprovalView token={params.token} creative={creative} />
}
