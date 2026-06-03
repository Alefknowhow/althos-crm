'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, FadeInItem } from './FadeIn'

// ── Spotlight card (blue glow for dark theme) ─────────────────────────────────

function SpotlightCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    cardRef.current.style.setProperty('--sx', `${e.clientX - rect.left}px`)
    cardRef.current.style.setProperty('--sy', `${e.clientY - rect.top}px`)
  }
  function handleMouseLeave() {
    cardRef.current?.style.setProperty('--sx', '50%')
    cardRef.current?.style.setProperty('--sy', '50%')
  }
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden ${className}`}
      style={{ '--sx': '50%', '--sy': '50%' } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background: 'radial-gradient(280px circle at var(--sx) var(--sy), rgba(59,130,246,0.12), transparent 70%)' }} />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}

// ── Section heading helper ────────────────────────────────────────────────────

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
      ✦ {children}
    </span>
  )
}

// ── Trust logos strip ─────────────────────────────────────────────────────────

export function TrustLogos() {
  const logos = ['AGÊNCIA 360', 'VIAJAR+', 'CLÍNICA PRIME', 'IMOBILIÁRIA NOVOLAR', 'AGÊNCIA NEXT', 'INOVA DIGITAL']
  return (
    <FadeIn>
      <section id="integracoes" className="border-y border-white/8 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-6">
            Empresas que confiam e crescem com a gente
          </p>
          <div className="flex items-center justify-start sm:justify-center gap-x-8 sm:gap-x-12 gap-y-4 overflow-x-auto sm:flex-wrap pb-1">
            {logos.map(l => (
              <span key={l} className="text-[13px] sm:text-sm font-bold tracking-tight text-white/35 hover:text-white/60 transition-colors whitespace-nowrap">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

// ── Features grid (6 cards) ───────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'CRM Completo',
    desc: 'Organize leads, oportunidades e clientes em um só lugar.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    ),
  },
  {
    title: 'Atendimento com IA',
    desc: 'Responda, qualifique e converta leads 24h por dia.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8M8 14h5m-9 7 3.5-2A9 9 0 1 1 21 12a9 9 0 0 1-13.5 7.794L4 21Z" />
      </svg>
    ),
  },
  {
    title: 'Automações',
    desc: 'Automatize follow-ups, mensagens e tarefas.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7Z" />
      </svg>
    ),
  },
  {
    title: 'WhatsApp Integrado',
    desc: 'Centralize conversas e tenha mais controle.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.3 48.3 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.4 48.4 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    title: 'Relatórios Inteligentes',
    desc: 'Dashboards avançados para decisões melhores.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    title: 'Integrações Nativas',
    desc: 'Conecte com Meta Ads, Google Ads e muito mais.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
  },
]

export function FeaturesGrid() {
  return (
    <section id="funcionalidades" className="py-12 sm:py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-8 sm:mb-14">
          <SectionEyebrow>Recursos</SectionEyebrow>
          <h2 className="mt-3 text-2xl sm:mt-4 sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Tudo que sua empresa precisa para{' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">vender mais</span>{' '}
            e crescer rápido
          </h2>
        </FadeIn>

        <FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" stagger={0.08}>
          {FEATURES.map(f => (
            <FadeInItem key={f.title}>
              <SpotlightCard className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 h-full hover:border-blue-500/30 transition-colors duration-300 sm:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 mb-3 sm:h-11 sm:w-11 sm:mb-4">
                  {f.icon}
                </div>
                <h3 className="text-[15px] sm:text-base font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-[13px] sm:text-[14px] text-white/55 leading-relaxed">{f.desc}</p>
              </SpotlightCard>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

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

// ── Trust seals strip ─────────────────────────────────────────────────────────

export function TrustSeals() {
  const seals = [
    {
      title: 'Cancelamento fácil', sub: 'Cancele quando quiser.',
      icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    },
    {
      title: 'Sem fidelidade', sub: 'Você tem total liberdade.',
      icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
    },
    {
      title: 'Ambiente seguro', sub: 'Seus dados protegidos.',
      icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    },
    {
      title: 'Suporte humanizado', sub: 'Time especializado.',
      icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.9 17.9 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    },
  ]
  return (
    <FadeIn>
      <section className="border-y border-white/8 py-8 sm:py-10">
        <FadeInStagger className="mx-auto max-w-5xl px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {seals.map(s => (
            <FadeInItem key={s.title} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-blue-400 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white leading-tight">{s.title}</p>
                <p className="text-[11px] text-white/45 leading-tight">{s.sub}</p>
              </div>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </section>
    </FadeIn>
  )
}

// ── Testimonials ──────────────────────────────────────────────────────────────

export function Testimonials() {
  const items = [
    {
      quote: 'O Althos CRM organizou nosso comercial e a IA mudou completamente nosso atendimento. Vendas +35% em 60 dias.',
      name: 'Rafael Martins', role: 'CEO – Agência 360', color: '#3B82F6',
    },
    {
      quote: 'As automações e o WhatsApp integrado nos fizeram recuperar muitos leads que estavam sendo perdidos.',
      name: 'Juliana Alves', role: 'Diretora – Viajar+', color: '#8B5CF6',
    },
    {
      quote: 'Dashboard e relatórios nos deram clareza para investir certo e crescer com previsibilidade.',
      name: 'Carlos Eduardo', role: 'Gestor – Imobiliária Novolar', color: '#06B6D4',
    },
  ]
  return (
    <section id="depoimentos" className="py-12 sm:py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-8 sm:mb-14">
          <SectionEyebrow>Depoimentos</SectionEyebrow>
          <h2 className="mt-3 text-2xl sm:mt-4 sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Quem usa, recomenda
          </h2>
          <p className="mt-2 text-[14px] sm:mt-3 sm:text-lg text-white/55 max-w-xl mx-auto">
            Empresas que aumentaram vendas, ganharam tempo e escalaram com o Althos CRM.
          </p>
        </FadeIn>

        <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5" stagger={0.12}>
          {items.map(t => (
            <FadeInItem key={t.name}>
              <SpotlightCard className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 h-full flex flex-col sm:p-6">
                <div className="flex items-center gap-0.5 text-amber-400 text-sm mb-3 sm:mb-4">★★★★★</div>
                <p className="text-[14px] sm:text-[15px] text-white/80 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/8 sm:mt-5 sm:pt-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-semibold shrink-0" style={{ background: t.color }}>
                    {t.name[0]}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white">{t.name}</p>
                    <p className="text-[11px] text-white/45">{t.role}</p>
                  </div>
                </div>
              </SpotlightCard>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-24">
      <FadeIn>
        <div className="rounded-2xl sm:rounded-3xl border border-blue-500/20 p-6 sm:p-12 md:p-14 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F1B33 0%, #0A0E1A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[300px] sm:h-[420px] w-[520px] sm:w-[760px] rounded-full bg-blue-600/15 blur-[120px]" />
          </div>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-5 text-left sm:gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
                Pronto para{' '}
                <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">transformar seus resultados?</span>
              </h2>
              <p className="mt-2 text-[14px] sm:mt-3 sm:text-lg text-white/60 max-w-xl">
                Teste grátis por 7 dias e descubra como o Althos CRM pode acelerar o crescimento do seu negócio.
              </p>
            </div>
            <div className="w-full shrink-0 flex flex-col items-center gap-2 sm:w-auto">
              <Link
                href="/signup"
                className="w-full rounded-xl bg-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap text-center sm:w-auto sm:py-3.5 sm:text-[15px]"
              >
                Testar grátis por 7 dias
              </Link>
              <p className="text-xs text-white/40">Plano Free grátis · sem cartão</p>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
