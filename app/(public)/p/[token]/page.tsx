import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicQuotationView, { type PublicQuotation } from '@/components/features/quotations/PublicQuotationView'

/**
 * Proposta pública de viagem.
 *
 * Leitura EXCLUSIVAMENTE pela RPC security-definer get_public_quotation
 * (anon key — nada de service role aqui). GET cacheável com tag por token:
 * o editor chama revalidateTag('quotation:{token}') ao salvar/enviar, então
 * o link pode viralizar no WhatsApp sem custo de banco por visita.
 */

export const revalidate = 300 // fallback; invalidação real é on-demand por tag

async function fetchQuotation(token: string): Promise<PublicQuotation | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null
  const res = await fetch(
    `${base}/rest/v1/rpc/get_public_quotation?p_token=${encodeURIComponent(token)}`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      next: { tags: [`quotation:${token}`], revalidate: 300 },
    },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data && typeof data === 'object' ? (data as PublicQuotation) : null
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const q = await fetchQuotation(params.token)
  const title = q?.title || 'Proposta de viagem'
  const fullTitle = q?.org?.legal_name ? `${title} — ${q.org.legal_name}` : title
  const description = q?.client_name ? `Proposta de viagem para ${q.client_name}` : 'Proposta de viagem personalizada'
  const image = q?.cover_image_url || undefined
  return {
    title: fullTitle,
    description,
    robots: { index: false, follow: false },
    // og:title/og:description/og:image — é isso que o WhatsApp lê pra montar
    // o card de preview quando o link da proposta é compartilhado.
    openGraph: {
      title: fullTitle,
      description,
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 630, alt: fullTitle }] : undefined,
    },
  }
}

export default async function PublicQuotationPage({ params }: { params: { token: string } }) {
  const q = await fetchQuotation(params.token)
  if (!q) notFound()
  return <PublicQuotationView data={q} />
}
