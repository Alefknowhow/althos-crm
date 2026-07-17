import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import type { NicheContent } from '@/lib/landing/niches'

/**
 * Página de nicho data-driven. Recebe um objeto NicheContent e renderiza
 * hero + dores + como resolve + recursos + casos de uso + FAQ + CTA final.
 * Usa o tema claro do SiteShell e Tailwind (mesmo padrão das páginas
 * institucionais). FAQ usa <details> nativo para funcionar sem JS.
 */
/** JSON-LD para rich results de FAQ no Google (mesmo padrão da página /faq). */
function faqJsonLd(c: NicheContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

export function NicheLanding({ c }: { c: NicheContent }) {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(c)) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-20 sm:pb-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-[480px] w-[480px] rounded-full bg-indigo-400/20 blur-[120px]" />
          <div className="absolute top-0 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-400/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {c.eyebrow}
          </span>
          <h1 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:mt-5 sm:text-5xl">
            {c.h1}{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              {c.h1Accent}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
            {c.sub}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full justify-center rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 sm:w-auto"
            >
              Começar grátis
            </Link>
            <Link
              href="/planos"
              className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 text-[15px] font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-slate-50 sm:w-auto"
            >
              Ver planos
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">✓ Grátis para sempre · sem cartão</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {c.heroChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 shadow-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Dores */}
      <section className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Soa familiar?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-slate-600 sm:text-base">
            Os gargalos que travam vendas no seu dia a dia — e que a Althos resolve.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {c.dores.map((d) => (
            <div
              key={d.t}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 sm:text-base">{d.t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 sm:text-sm">{d.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Como resolve */}
      <section className="relative border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Como a Althos resolve
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Do primeiro contato ao fechamento, no automático
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {c.resolve.map((r) => (
              <div
                key={r.n}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="text-sm font-bold text-indigo-600">{r.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{r.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Recursos pensados para o seu negócio
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.recursos.map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-slate-900 sm:text-base">{f.t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 sm:text-sm">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Casos de uso */}
      <section className="relative border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Na prática</h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] text-slate-600 sm:text-base">
              Situações reais que deixam de ser problema com a Althos.
            </p>
          </div>
          <ul className="mt-9 space-y-3">
            {c.casos.map((caso, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
              >
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <span className="text-[14px] leading-relaxed text-slate-700">{caso}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {c.faq.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-4 text-[15px] font-semibold text-slate-900 marker:content-['']">
                {item.q}
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-slate-300 text-slate-400 transition-transform group-open:rotate-45">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">{c.ctaTitle}</h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] text-slate-600 sm:text-lg">{c.ctaSub}</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 sm:w-auto"
            >
              Começar grátis
            </Link>
            <Link
              href="/como-funciona"
              className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-[15px] font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-slate-50 sm:w-auto"
            >
              Como funciona
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">✓ Plano Free grátis · sem cartão · sem fidelidade</p>
        </div>
      </section>
    </SiteShell>
  )
}
