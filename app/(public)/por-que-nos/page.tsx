import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { SiteIcon } from '@/components/site/SiteIcon'
import { DIFFERENTIATORS } from '@/lib/site/content'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Por Que Escolher Nosso CRM Brasileiro',
  description:
    'IA de verdade, pronto em minutos, adaptável ao seu nicho, suporte em português e preço honesto. Veja por que escolher o Althos CRM.',
  path: '/por-que-nos',
})

export default function PorQueNosPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#4589ff]/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            Por que nós?
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:mt-5 sm:text-5xl">
            Mais que um CRM. Um time a mais no seu negócio.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-lg">
            Construído para quem precisa de resultado, não de mais um software complicado para configurar.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map(d => (
            <div
              key={d.title}
              className="rounded-none border border-[#383838] bg-[#262626] p-6   transition-colors hover:border-[#78a9ff]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-none bg-gradient-to-br from-blue-500 to-blue-700 text-white   shadow-blue-600/25">
                <SiteIcon name={d.icon} className="h-5.5 w-5.5" />
              </span>
              <h2 className="mt-4 text-[16px] font-bold text-[#f4f4f4]">{d.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#a8a8a8]">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo simples */}
      <section className="relative mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="rounded-none border border-[#383838] bg-[#262626] p-7   sm:p-9">
          <h2 className="text-center text-xl font-bold text-[#f4f4f4] sm:text-2xl">
            Planilha e WhatsApp solto vs. Althos CRM
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="rounded-none border border-[#383838] bg-[#1f1f1f] p-5">
              <p className="text-[13px] font-semibold text-[#8d8d8d]">Do jeito antigo</p>
              <ul className="mt-3 space-y-2 text-[13px] text-[#8d8d8d]">
                <li>• Leads perdidos entre conversas</li>
                <li>• Follow-up depende da memória</li>
                <li>• Sem visão de funil ou resultado</li>
                <li>• Atendimento manual e lento</li>
              </ul>
            </div>
            <div className="rounded-none border border-[#4589ff]/40 bg-[#0f62fe]/10 p-5">
              <p className="text-[13px] font-semibold text-[#78a9ff]">Com o Althos</p>
              <ul className="mt-3 space-y-2 text-[13px] text-[#d4d4d4]">
                <li>• Cada conversa vira um lead rastreável</li>
                <li>• Automações cuidam do follow-up</li>
                <li>• Dashboards e previsão de receita</li>
                <li>• IA atende e agenda 24h</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <Link
          href="/signup"
          className="inline-flex rounded-none bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
        >
          Começar grátis
        </Link>
      </section>
    </SiteShell>
  )
}
