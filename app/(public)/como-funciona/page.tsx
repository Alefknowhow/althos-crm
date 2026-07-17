import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { HOW_IT_WORKS } from '@/lib/site/content'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Como Funciona a Automação de Vendas',
  description:
    'Conecte seus canais, configure a IA e as automações, acompanhe o funil e decida com dados. Veja como começar com o Althos CRM em 4 passos.',
  path: '/como-funciona',
})

export default function ComoFuncionaPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Como funciona
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:mt-5 sm:text-5xl">
            Do zero ao primeiro lead em minutos
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
            Sem implantação demorada. Quatro passos simples e sua operação já está rodando.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <div className="relative">
          {/* Linha conectora */}
          <div className="pointer-events-none absolute left-[27px] top-4 bottom-4 hidden w-px bg-gradient-to-b from-indigo-400/50 via-slate-200 to-transparent sm:block" />
          <div className="space-y-5">
            {HOW_IT_WORKS.map(s => (
              <div
                key={s.number}
                className="relative flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
              >
                <span className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-lg font-bold text-white shadow-lg shadow-blue-600/30">
                  {s.number}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{s.title}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Comece hoje mesmo</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-slate-600">
          Comece de graça no plano Free, sem cartão. Configure em minutos e veja a diferença.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
        >
          Criar minha conta grátis
        </Link>
      </section>
    </SiteShell>
  )
}
