import Link from 'next/link'
import { LandingNav } from '@/components/landing/LandingNav'
import { LandingHero } from '@/components/landing/LandingHero'
import {
  TrustLogos,
  FeaturesGrid,
  PricingSection,
  TrustSeals,
  Testimonials,
  FinalCTA,
} from '@/components/landing/LandingAnimatedSections'

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#0A0E1A] text-white antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif' }}
    >
      <LandingNav />
      <div className="h-14" />

      <LandingHero />
      <TrustLogos />
      <FeaturesGrid />
      <PricingSection />
      <TrustSeals />
      <Testimonials />
      <FinalCTA />

      {/* Footer */}
      <footer className="border-t border-white/8 bg-[#070B14] py-12 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black">A</span>
                <span className="text-base font-semibold text-white">ALTHOS <span className="text-white/40 font-normal">CRM</span></span>
              </div>
              <p className="mt-3 text-sm text-white/45 max-w-xs leading-relaxed">
                CRM completo com IA e automações para empresas que querem vender mais e escalar com eficiência.
              </p>
              <div className="mt-4 flex items-center gap-3">
                {['Instagram', 'Facebook', 'LinkedIn', 'YouTube'].map(s => (
                  <span key={s} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 text-[10px] hover:text-white/70 transition-colors">
                    {s[0]}
                  </span>
                ))}
              </div>
            </div>

            {/* Produto */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Produto</p>
              <ul className="space-y-2 text-sm text-white/45">
                <li><Link href="#funcionalidades" className="hover:text-white transition-colors">Recursos</Link></li>
                <li><Link href="#planos" className="hover:text-white transition-colors">Planos</Link></li>
                <li><Link href="#integracoes" className="hover:text-white transition-colors">Integrações</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Novidades</Link></li>
              </ul>
            </div>

            {/* Empresa */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Empresa</p>
              <ul className="space-y-2 text-sm text-white/45">
                <li><Link href="#depoimentos" className="hover:text-white transition-colors">Sobre nós</Link></li>
                <li><a href="mailto:suporte@althos.io" className="hover:text-white transition-colors">Contato</a></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Parceiros</Link></li>
              </ul>
            </div>

            {/* Suporte */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Suporte</p>
              <ul className="space-y-2 text-sm text-white/45">
                <li><a href="mailto:suporte@althos.io" className="hover:text-white transition-colors">Central de ajuda</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Entrar</Link></li>
                <li><span>Atendimento 24h</span></li>
              </ul>
            </div>

            {/* Trial card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-sm font-semibold text-white">7 dias grátis para testar</p>
              </div>
              <ul className="space-y-1.5 text-[12px] text-white/55">
                {['Sem cartão de crédito', 'Sem compromisso', 'Cancele quando quiser'].map(i => (
                  <li key={i} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {i}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-4 block rounded-lg bg-blue-600 py-2 text-center text-[13px] font-semibold text-white hover:bg-blue-500 transition-colors">
                Começar agora
              </Link>
            </div>
          </div>

          <div className="mt-10 border-t border-white/8 pt-6 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/35">© {new Date().getFullYear()} Althos CRM. Todos os direitos reservados.</p>
            <p className="text-xs text-white/35">Feito no Brasil 🇧🇷</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
