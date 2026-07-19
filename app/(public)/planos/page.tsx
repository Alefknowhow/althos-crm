import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { PricingPlans } from '@/components/site/PricingPlans'
import { PUBLIC_PLANS } from '@/lib/billing/plans'

const TITLE = 'Planos e Preços — Althos CRM'
const DESCRIPTION =
  'Planos transparentes do Althos CRM. Comece de graça no plano Free, sem cartão. Pague mensal ou economize 18% no anual.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/planos' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/planos',
    siteName: 'Althos CRM',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

/** JSON-LD com os preços reais (mesma fonte que a UI de checkout usa). */
function pricingJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Althos CRM',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0.00', priceCurrency: 'BRL' },
      ...PUBLIC_PLANS.map(p => ({
        '@type': 'Offer' as const,
        name: p.label,
        price: ((p.priceCents ?? 0) / 100).toFixed(2),
        priceCurrency: 'BRL',
        priceSpecification: { '@type': 'RecurringCharge', billingIncrement: 1, unitCode: 'MON' },
      })),
    ],
  }
}

export default function PlanosPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd()) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#4589ff]/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a6c8ff] bg-[#edf5ff] px-3 py-1 text-xs font-medium text-[#0043ce]">
            Planos e preços
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:mt-5 sm:text-5xl">
            Um preço justo para cada fase do seu negócio
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
            Comece de graça no plano Free, sem cartão. Mude de plano quando quiser. Sem pegadinha.
          </p>
        </div>
      </section>

      {/* Planos */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <PricingPlans />
      </section>

      {/* CTA final */}
      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <div className="rounded-none border border-slate-200 bg-white p-8   sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">Ainda com dúvidas?</h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-slate-600">
            Veja as perguntas frequentes ou fale com a gente. Estamos prontos para ajudar a escolher o plano ideal.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/faq"
              className="rounded-none border border-slate-300 px-6 py-3 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Ver FAQ
            </Link>
            <a
              href="mailto:suporte@althoscrm.com.br"
              className="rounded-none bg-blue-600 px-6 py-3 text-[14px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
            >
              Falar com a gente
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
