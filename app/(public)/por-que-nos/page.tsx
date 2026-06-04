import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { SiteIcon } from '@/components/site/SiteIcon'
import { DIFFERENTIATORS } from '@/lib/site/content'

export const metadata: Metadata = {
  title: 'Por que nós? — Althos CRM',
  description:
    'IA de verdade, pronto em minutos, adaptável ao seu nicho, suporte em português e preço honesto. Veja por que escolher o Althos CRM.',
}

export default function PorQueNosPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            Por que nós?
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:mt-5 sm:text-5xl">
            Mais que um CRM. Um time a mais no seu negócio.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/55 sm:mt-4 sm:text-lg">
            Construído para quem precisa de resultado, não de mais um software complicado para configurar.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map(d => (
            <div
              key={d.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25">
                <SiteIcon name={d.icon} className="h-5.5 w-5.5" />
              </span>
              <h2 className="mt-4 text-[16px] font-bold text-white">{d.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo simples */}
      <section className="relative mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-7 sm:p-9">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">
            Planilha e WhatsApp solto vs. Althos CRM
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.01] p-5">
              <p className="text-[13px] font-semibold text-white/50">Do jeito antigo</p>
              <ul className="mt-3 space-y-2 text-[13px] text-white/45">
                <li>• Leads perdidos entre conversas</li>
                <li>• Follow-up depende da memória</li>
                <li>• Sem visão de funil ou resultado</li>
                <li>• Atendimento manual e lento</li>
              </ul>
            </div>
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-5">
              <p className="text-[13px] font-semibold text-blue-300">Com o Althos</p>
              <ul className="mt-3 space-y-2 text-[13px] text-white/70">
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
          className="inline-flex rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
        >
          Começar grátis
        </Link>
      </section>
    </SiteShell>
  )
}
