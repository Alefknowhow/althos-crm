import Link from 'next/link'
import { LandingNav } from '@/components/landing/LandingNav'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingStickyFeatures } from '@/components/landing/LandingStickyFeatures'
import {
  SocialProofStrip,
  PlatformsSection,
  StatsSection,
  AISection,
  MetaSection,
  PricingSection,
  FinalCTA,
} from '@/components/landing/LandingAnimatedSections'

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-black/8 py-4 sm:py-5">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[15px] sm:text-[17px] font-medium text-[#1D1D1F] list-none">
        {q}
        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-[#6E6E73] transition-transform group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </summary>
      <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#6E6E73] leading-relaxed pr-4 sm:pr-8">{a}</p>
    </details>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1D1D1F] antialiased" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif' }}>

      <LandingNav />
      <div className="h-14" />

      <LandingHero />
      <SocialProofStrip />
      <LandingStickyFeatures />
      <StatsSection />
      <PlatformsSection />
      <AISection />
      <MetaSection />
      <PricingSection />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-14 sm:py-20 md:py-28">
        <div className="text-center mb-8 sm:mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
            Dúvidas
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">Perguntas frequentes.</h2>
        </div>
        <div className="divide-y divide-black/5">
          <FaqItem q="Preciso de cartão para testar?" a="Não. O trial de 7 dias é totalmente gratuito e não exige nenhuma forma de pagamento. Você só precisa criar uma conta com e-mail e senha." />
          <FaqItem q="O Althos CRM realmente substitui o ManyChat?" a="Sim. O Althos inclui automação de DMs do Instagram e respostas a comentários com IA — a mesma funcionalidade principal do ManyChat. Quando alguém manda uma DM ou comenta em seu post, a IA responde automaticamente como um humano, capta o lead e registra tudo no CRM." />
          <FaqItem q="Como funciona o WhatsApp?" a="O Althos CRM se conecta ao WhatsApp Business API. Você recebe e responde mensagens diretamente no painel, com histórico vinculado ao lead. Configuração em Configurações → WhatsApp em menos de 5 minutos." />
          <FaqItem q="A IA responde como humano mesmo?" a="Sim. Você configura a persona com o nome, tom de voz e contexto do seu negócio. Ela responde DMs, comentários e WhatsApp de forma natural, sem parecer robótica. Quanto mais contexto você fornecer, melhor a qualidade." />
          <FaqItem q="O que acontece quando o trial termina?" a="Após 7 dias você escolhe um plano. Seus dados ficam salvos por até 30 dias caso decida retornar. Nenhum lead é apagado automaticamente durante esse período." />
          <FaqItem q="Posso cancelar quando quiser?" a="Sim. Não há fidelidade mínima. O cancelamento é feito em um clique e vale para o próximo ciclo de cobrança — você continua com acesso até o fim do mês pago." />
          <FaqItem q="Tem suporte para clientes de agência?" a="Sim. Temos um plano Agency exclusivo para clientes da Althos Performance, com onboarding dedicado e acesso completo. Entre em contato para saber mais." />
        </div>
      </section>

      <FinalCTA />

      {/* Footer */}
      <footer className="border-t border-black/5 bg-[#F5F5F7] py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-6 sm:gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-base font-semibold text-[#1D1D1F]">Althos CRM</span>
              <p className="mt-1 text-sm text-[#6E6E73] max-w-xs">Um sistema. Cinco ferramentas. Por muito menos.</p>
            </div>
            <div className="grid grid-cols-3 gap-6 sm:gap-8 text-sm">
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-2 sm:mb-3">Produto</p>
                <ul className="space-y-1.5 sm:space-y-2 text-[#6E6E73]">
                  <li><Link href="#funcionalidades" className="hover:text-[#1D1D1F] transition-colors">Funcionalidades</Link></li>
                  <li><Link href="/pricing" className="hover:text-[#1D1D1F] transition-colors">Preços</Link></li>
                  <li><Link href="/signup" className="hover:text-[#1D1D1F] transition-colors">Grátis</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-2 sm:mb-3">Conta</p>
                <ul className="space-y-1.5 sm:space-y-2 text-[#6E6E73]">
                  <li><Link href="/login" className="hover:text-[#1D1D1F] transition-colors">Login</Link></li>
                  <li><Link href="/signup" className="hover:text-[#1D1D1F] transition-colors">Cadastro</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-2 sm:mb-3">Suporte</p>
                <ul className="space-y-1.5 sm:space-y-2 text-[#6E6E73]">
                  <li><a href="mailto:suporte@althos.io" className="hover:text-[#1D1D1F] transition-colors">E-mail</a></li>
                  <li><span>Atendimento 24h</span></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 sm:mt-12 border-t border-black/5 pt-5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#6E6E73]">© {new Date().getFullYear()} Althos Performance. Todos os direitos reservados.</p>
            <p className="text-xs text-[#6E6E73]">Feito no Brasil 🇧🇷</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
