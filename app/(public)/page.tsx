import Link from 'next/link'
import Image from 'next/image'
import { SiteShell } from '@/components/site/SiteShell'
import { LandingHero } from '@/components/landing/LandingHero'
import {
  TrustLogos,
  FeaturesGrid,
  TrustSeals,
  Testimonials,
  FinalCTA,
} from '@/components/landing/LandingAnimatedSections'
import { PricingPlans } from '@/components/site/PricingPlans'
import { SiteIcon } from '@/components/site/SiteIcon'
import { NICHES } from '@/lib/site/content'

export default function LandingPage() {
  return (
    <SiteShell>
      <LandingHero />
      <TrustLogos />
      <FeaturesGrid />

      {/* Faixa de nichos → /para-quem-e */}
      <section className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            Feito para o seu nicho
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:mt-4 sm:text-4xl">
            Um CRM que fala a língua do seu negócio
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-white/55 sm:mt-3 sm:text-[15px]">
            Recursos pensados para as particularidades de cada segmento.
          </p>
        </div>
        <div className="mt-7 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {NICHES.map(n => (
            <Link
              key={n.slug}
              href={`/para-quem-e#${n.slug}`}
              className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-blue-500/40 hover:bg-white/[0.04] sm:p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25 sm:h-11 sm:w-11">
                <SiteIcon name={n.icon} className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-white sm:text-[15px]">{n.name}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/50 sm:mt-1 sm:text-[13px]">{n.solution.split('.')[0]}.</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center sm:mt-8">
          <Link href="/para-quem-e" className="text-[14px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Ver todos os segmentos →
          </Link>
        </div>
      </section>

      {/* Mascote band */}
      <section className="relative overflow-hidden py-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-5xl items-center gap-5 px-4 sm:gap-8 sm:px-6 lg:grid-cols-[260px_1fr]">
          <div className="mx-auto">
            <Image
              src="/mascote.png"
              alt="Mascote do Althos CRM"
              width={260}
              height={260}
              className="h-auto w-[150px] drop-shadow-2xl sm:w-[210px] lg:w-[260px]"
              priority={false}
            />
          </div>
          <div className="text-center lg:text-left">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-4xl">
              O Althos trabalha enquanto você dorme
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/60 sm:mt-4 sm:text-[15px] lg:mx-0">
              Atendimento com IA 24h, automações que cuidam do follow-up e relatórios que se montam sozinhos.
              Você foca em vender; o resto, deixa com a gente.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-6 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors sm:mt-6 sm:px-7 sm:py-3 sm:text-[15px]"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </section>

      {/* Planos com toggle mensal/anual */}
      <section id="planos" className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-4xl">
            Planos para cada fase do seu negócio
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-white/55 sm:mt-3 sm:text-[15px]">
            Mensal ou anual com 18% de desconto. Comece grátis, sem cartão.
          </p>
        </div>
        <div className="mt-7 sm:mt-10">
          <PricingPlans />
        </div>
      </section>

      <TrustSeals />
      <Testimonials />
      <FinalCTA />
    </SiteShell>
  )
}
