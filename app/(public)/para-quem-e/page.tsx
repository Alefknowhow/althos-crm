import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { SiteShell } from '@/components/site/SiteShell'
import { SiteIcon } from '@/components/site/SiteIcon'
import { NICHES, NICHE_SLUGS } from '@/lib/landing/niches'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Para Cada Tipo de Negócio',
  description:
    'Agências de viagens, imobiliárias, clínicas, escritórios de advocacia e corretoras de seguros. Veja como o Althos CRM se adapta ao seu negócio.',
  path: '/para-quem-e',
})

/** Ícone por nicho — alinhado ao mesmo slug usado em lib/landing/niches.ts. */
const NICHE_ICON: Record<string, string> = {
  viagens: 'Plane',
  imobiliarias: 'Home',
  clinicas: 'Stethoscope',
  advocacia: 'Scale',
  seguros: 'ShieldCheck',
}

export default function ParaQuemEPage() {
  const niches = NICHE_SLUGS.map(slug => NICHES[slug])

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
          {niches.map(n => (
            <a
              key={n.slug}
              href={`#${n.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#383838] bg-[#262626] px-4 py-2 text-[13px] font-medium text-[#a8a8a8]   hover:border-[#78a9ff] hover:text-[#f4f4f4] transition-colors"
            >
              <SiteIcon name={NICHE_ICON[n.slug]} className="h-4 w-4 text-[#4589ff]" />
              {n.nav}
            </a>
          ))}
        </div>
      </section>

      {/* Blocos por nicho */}
      <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="space-y-6">
          {niches.map(n => (
            <div
              key={n.slug}
              id={n.slug}
              className="scroll-mt-20 grid gap-6 rounded-none border border-[#383838] bg-[#262626] p-7   sm:p-9 lg:grid-cols-[1fr_1.1fr]"
            >
              {/* Esquerda: público + dores */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-none bg-blue-600 text-white   shadow-blue-600/30">
                    <SiteIcon name={NICHE_ICON[n.slug]} className="h-5.5 w-5.5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[#f4f4f4]">{n.nav}</h2>
                      {n.emBreve && (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#8d8d8d]">{n.eyebrow}</p>
                  </div>
                </div>
                <p className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-[#707070]">
                  As dores de sempre
                </p>
                <ul className="mt-3 space-y-2.5">
                  {n.dores.map(p => (
                    <li key={p.t} className="flex items-start gap-2.5 text-[13px] text-[#a8a8a8]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/70" />
                      {p.t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Direita: solução */}
              <div className="rounded-none border border-[#4589ff]/40 bg-[#0f62fe]/10 p-5 sm:p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#78a9ff]">
                  Como o Althos resolve
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#d4d4d4]">{n.sub}</p>
                <ul className="mt-5 space-y-2.5 border-t border-[#4589ff]/40 pt-5">
                  {n.recursos.map(h => (
                    <li key={h.t} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-[13px] text-[#d4d4d4]">{h.t}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${n.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#78a9ff] hover:text-[#a6c8ff] transition-colors"
                >
                  Ver página completa <span aria-hidden="true">→</span>
                </Link>
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
