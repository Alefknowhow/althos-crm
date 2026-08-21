import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicPropertyProposalView, { type PublicPropertyProposal } from '@/components/features/properties/PublicPropertyProposalView'

/**
 * Proposta pública de imóvel (Vertical Imobiliárias, Fase 8) — mesmo
 * desenho de app/(public)/p/[token]/page.tsx (Viagens): leitura
 * exclusivamente pela RPC security-definer get_public_property_proposal
 * (anon key, sem service role), cacheada por tag por token.
 */

export const revalidate = 300

async function fetchProposal(token: string): Promise<PublicPropertyProposal | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null
  const res = await fetch(
    `${base}/rest/v1/rpc/get_public_property_proposal?p_token=${encodeURIComponent(token)}`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      next: { tags: [`property-proposal:${token}`], revalidate: 300 },
    },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data && typeof data === 'object' ? (data as PublicPropertyProposal) : null
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const p = await fetchProposal(params.token)
  const title = 'Proposta de imóveis'
  const fullTitle = p?.org?.legal_name ? `${title} — ${p.org.legal_name}` : title
  const image = p?.items?.[0]?.photos?.[0]?.url
  return {
    title: fullTitle,
    description: `Proposta com ${p?.items?.length || 0} imóvel(is) selecionado(s)`,
    robots: { index: false, follow: false },
    openGraph: {
      title: fullTitle,
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 630, alt: fullTitle }] : undefined,
    },
  }
}

export default async function PublicPropertyProposalPage({ params }: { params: { token: string } }) {
  const p = await fetchProposal(params.token)
  if (!p) notFound()
  return <PublicPropertyProposalView data={p} />
}
