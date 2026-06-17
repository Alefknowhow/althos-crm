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
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Por que nós?
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:mt-5 sm:text-5xl">
            Mais que um CRM. Um time a mais no seu negócio.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
            Construído para quem precisa de resultado, não de mais um software complicado para configurar.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map(d => (
            <div
              key={d.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-indigo-300"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25">
                <SiteIcon name={d.icon} className="h-5.5 w-5.5" />
              </span>
              <h2 className="mt-4 text-[16px] font-bold text-slate-900">{d.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo simples */}
      <section className="relative mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
            Planilha e WhatsApp solto vs. Althos CRM
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[13px] font-semibold text-slate-500">Do jeito antigo</p>
              <ul className="mt-3 space-y-2 text-[13px] text-slate-500">
                <li>• Leads perdidos entre conversas</li>
                <li>• Follow-up depende da memória</li>
                <li>• Sem visão de funil ou resultado</li>
                <li>• Atendimento manual e lento</li>
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="text-[13px] font-semibold text-indigo-700">Com o Althos</p>
              <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
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
