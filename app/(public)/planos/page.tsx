import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { PricingPlans } from '@/components/site/PricingPlans'

export const metadata: Metadata = {
  title: 'Planos e Preços — Althos CRM',
  description:
    'Planos transparentes do Althos CRM. Comece de graça no plano Free, sem cartão. Pague mensal ou economize 18% no anual.',
}

export default function PlanosPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            Planos e preços
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:mt-5 sm:text-5xl">
            Um preço justo para cada fase do seu negócio
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/55 sm:mt-4 sm:text-lg">
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-white">Ainda com dúvidas?</h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-white/55">
            Veja as perguntas frequentes ou fale com a gente. Estamos prontos para ajudar a escolher o plano ideal.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/faq"
              className="rounded-xl border border-white/15 px-6 py-3 text-[14px] font-semibold text-white hover:bg-white/5 transition-colors"
            >
              Ver FAQ
            </Link>
            <a
              href="mailto:suporte@althoscrm.com.br"
              className="rounded-xl bg-blue-600 px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
            >
              Falar com a gente
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
