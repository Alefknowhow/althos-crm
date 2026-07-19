import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { FaqAccordion } from '@/components/site/FaqAccordion'
import { FAQ } from '@/lib/site/content'

export const metadata: Metadata = {
  title: 'Perguntas frequentes — Althos CRM',
  description:
    'Tire suas dúvidas sobre o Althos CRM: teste grátis, conexão do WhatsApp, atendente de IA, planos, desconto anual e segurança.',
}

/** JSON-LD para rich results de FAQ no Google. */
function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

export default function FaqPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#4589ff]/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            FAQ
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:mt-5 sm:text-5xl">
            Perguntas frequentes
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-lg">
            As dúvidas mais comuns sobre o Althos CRM. Não achou a sua? Fale com a gente.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <FaqAccordion />
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <div className="rounded-none border border-[#383838] bg-[#262626] p-8  ">
          <h2 className="text-xl font-bold text-[#f4f4f4]">Ainda tem dúvidas?</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#a8a8a8]">
            Nosso time responde em português, direto pela plataforma ou por e-mail.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:suporte@althoscrm.com.br"
              className="rounded-none bg-blue-600 px-6 py-3 text-[14px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
            >
              Falar com o suporte
            </a>
            <Link
              href="/signup"
              className="rounded-none border border-[#525252] px-6 py-3 text-[14px] font-semibold text-[#d4d4d4] hover:bg-[#1f1f1f] transition-colors"
            >
              Testar grátis
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
