'use client'

/**
 * Pricing card + section for the landing page. Split out of
 * LandingAnimatedSections.tsx.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, FadeInItem } from './FadeIn'

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
      ✦ {children}
    </span>
  )
}

function PricingCard({
  name, tag, price, desc, features, disabledFeatures, cta, highlight, badge,
}: {
  name: string
  tag?: string
  price: string
  desc: string
  features: string[]
  disabledFeatures?: string[]
  cta: string
  highlight?: boolean
  badge?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative rounded-2xl sm:rounded-3xl p-6 sm:p-7 flex flex-col gap-5 h-full border ${
        highlight ? 'border-blue-500/50' : 'border-white/10 bg-white/[0.02]'
      }`}
      style={highlight ? {
        background: 'linear-gradient(160deg, #1E3A5F 0%, #111827 60%)',
        boxShadow: '0 0 40px rgba(37,99,235,0.2)',
      } : undefined}
    >
      {badge && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-1 text-[10px] font-bold text-white shadow-lg whitespace-nowrap tracking-widest uppercase">
          ★ {badge}
        </span>
      )}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-lg sm:text-xl font-bold text-white">{name}</p>
          {tag && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              highlight ? 'bg-blue-500/20 text-blue-300' : 'bg-white/8 text-white/50'
            }`}>
              {tag}
            </span>
          )}
        </div>
        <div className="flex items-end gap-1 mb-1.5">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{price}</span>
          <span className="mb-1 text-sm text-white/50">/mês</span>
        </div>
        <p className="text-[13px] text-white/55 leading-relaxed">{desc}</p>
        <p className="mt-2 text-[11px] text-white/35">7 dias grátis · Pix ou cartão</p>
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[13px] text-white/80">{f}</span>
          </li>
        ))}
        {disabledFeatures?.map(f => (
          <li key={f} className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[13px] line-through text-white/30">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 ${
          highlight
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500'
            : 'bg-white/8 text-white border border-white/10 hover:bg-white/12'
        }`}
      >
        {cta}
      </Link>
    </motion.div>
  )
}

export function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      tag: 'Ideal para começar',
      price: 'R$ 197',
      desc: 'Para pequenos negócios que querem organizar e profissionalizar o atendimento.',
      features: [
        'Leads e clientes ilimitados',
        'Pipeline visual de oportunidades',
        'Formulários de captação',
        'WhatsApp integrado',
        'Registro de vendas',
        'Tarefas e atividades',
        'Histórico completo do cliente',
      ],
      disabledFeatures: ['Atendimento com IA 24/7', 'Automações', 'Multiusuário'],
      cta: 'Testar grátis por 7 dias',
    },
    {
      name: 'Pro',
      tag: 'Para crescer',
      badge: 'MAIS ESCOLHIDO',
      price: 'R$ 297',
      desc: 'Para empresas que querem automatizar processos e aumentar as vendas.',
      features: [
        'Tudo do plano Starter',
        'IA 24/7 para atendimento',
        'Automações ilimitadas',
        'Follow-up automático',
        'Score e insights de vendas por IA',
        'Instagram (DMs e comentários)',
        'Meta Ads + Google Ads + Pixel/CAPI',
        'E-mail marketing incluído',
        'Até 5 usuários · Suporte prioritário',
      ],
      cta: 'Testar grátis por 7 dias',
      highlight: true,
    },
    {
      name: 'Business',
      tag: 'Para escalar sem limites',
      price: 'R$ 397',
      desc: 'Para empresas que precisam de mais controle, dados e performance em escala.',
      features: [
        'Tudo do plano Pro',
        'IA avançada para análises e previsões',
        'Fluxos avançados de automação',
        'Painéis personalizados',
        'API aberta e webhooks',
        'Usuários ilimitados',
        'Times, departamentos e permissões',
        'Onboarding personalizado',
        'Gerente de conta dedicado · Suporte VIP',
      ],
      cta: 'Testar grátis por 7 dias',
    },
  ]

  return (
    <section id="planos" className="py-16 sm:py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-10 sm:mb-14">
          <SectionEyebrow>Planos flexíveis</SectionEyebrow>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Escolha o plano ideal para{' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">o seu momento</span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/55 max-w-xl mx-auto">
            Planos completos para atender desde pequenos negócios até empresas em escala.
          </p>
        </FadeIn>

        {/* Mobile: horizontal scroll. Desktop: grid */}
        <div className="md:hidden flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 pt-3">
          {plans.map(p => (
            <div key={p.name} className="snap-center shrink-0 w-[85vw] max-w-[330px]">
              <PricingCard {...p} />
            </div>
          ))}
        </div>
        <FadeInStagger className="hidden md:grid grid-cols-3 gap-5 max-w-5xl mx-auto pt-3" stagger={0.12}>
          {plans.map(p => (
            <FadeInItem key={p.name}>
              <PricingCard {...p} />
            </FadeInItem>
          ))}
        </FadeInStagger>

        <p className="mt-5 text-center text-xs text-white/40 md:hidden">← Deslize para ver todos os planos →</p>
      </div>
    </section>
  )
}
