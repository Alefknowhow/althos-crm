import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { SiteShell } from '@/components/site/SiteShell'
import { SiteIcon } from '@/components/site/SiteIcon'
import { NICHES } from '@/lib/site/content'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Para Cada Tipo de Time de Vendas',
  description:
    'Agências de viagens, imobiliárias, clínicas, lojas de veículos, agências de marketing e pequenas empresas. Veja como o Althos CRM se adapta ao seu negócio.',
  path: '/para-quem-e',
})

/** Mapeia o slug do nicho (content.ts) para a landing page dedicada. */
const NICHE_LANDING: Record<string, string> = {
  'agencias-viagens': '/viagens',
  imobiliarias: '/imobiliarias',
  clinicas: '/clinicas',
  veiculos: '/veiculos',
  marketing: '/trafego',
  'pequenas-empresas': '/pequenas-empresas',
}

export default function ParaQuemEPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#4589ff]/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            Para quem é
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:mt-5 sm:text-5xl">
            Um CRM que entende o seu negócio
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-lg">
            O Althos se adapta ao seu nicho — com recursos específicos para as dores do seu dia a dia.
          </p>
        </div>
      </section>

      {/* Atalhos de nicho */}
      <section className="relative mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <div className="flex flex-wrap justify-center gap-2">
          {NICHES.map(n => (
            <a
              key={n.slug}
              href={`#${n.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#383838] bg-[#262626] px-4 py-2 text-[13px] font-medium text-[#a8a8a8]   hover:border-[#78a9ff] hover:text-[#f4f4f4] transition-colors"
            >
              <SiteIcon name={n.icon} className="h-4 w-4 text-[#4589ff]" />
              {n.name}
            </a>
          ))}
        </div>
      </section>

      {/* Blocos por nicho */}
      <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="space-y-6">
          {NICHES.map((n, i) => (
            <div
              key={n.slug}
              id={n.slug}
              className="scroll-mt-20 grid gap-6 rounded-none border border-[#383838] bg-[#262626] p-7   sm:p-9 lg:grid-cols-[1fr_1.1fr]"
            >
              {/* Esquerda: público + dores */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-none bg-blue-600 text-white   shadow-blue-600/30">
                    <SiteIcon name={n.icon} className="h-5.5 w-5.5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-[#f4f4f4]">{n.name}</h2>
                    <p className="text-[12px] text-[#8d8d8d]">{n.audience}</p>
                  </div>
                </div>
                <p className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-[#707070]">
                  As dores de sempre
                </p>
                <ul className="mt-3 space-y-2.5">
                  {n.pains.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-[13px] text-[#a8a8a8]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/70" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Direita: solução */}
              <div className="rounded-none border border-[#4589ff]/40 bg-[#0f62fe]/10 p-5 sm:p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#78a9ff]">
                  Como o Althos resolve
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#d4d4d4]">{n.solution}</p>
                <ul className="mt-5 space-y-2.5 border-t border-[#4589ff]/40 pt-5">
                  {n.highlights.map(h => (
                    <li key={h} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-[13px] text-[#d4d4d4]">{h}</span>
                    </li>
                  ))}
                </ul>
                {NICHE_LANDING[n.slug] && (
                  <Link
                    href={NICHE_LANDING[n.slug]}
                    className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#78a9ff] hover:text-[#a6c8ff] transition-colors"
                  >
                    Ver página completa <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-[#f4f4f4] sm:text-3xl">Não viu o seu segmento?</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-[#a8a8a8]">
          O Althos é flexível e se adapta a praticamente qualquer operação comercial. Fale com a gente e descubra como.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-none bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
          >
            Testar grátis
          </Link>
          <a
            href="mailto:suporte@althoscrm.com.br"
            className="rounded-none border border-[#525252] px-7 py-3 text-[15px] font-semibold text-[#d4d4d4] hover:bg-[#1f1f1f] transition-colors"
          >
            Falar com a gente
          </a>
        </div>
      </section>
    </SiteShell>
  )
}
