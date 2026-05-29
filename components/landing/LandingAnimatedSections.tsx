'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, FadeInItem } from './FadeIn'

// ── Spotlight card ────────────────────────────────────────────────────────────

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
        style={{ background: 'radial-gradient(280px circle at var(--sx) var(--sy), rgba(99,102,241,0.06), transparent 70%)' }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedCounter({ from = 0, to, suffix = '', prefix = '' }: { from?: number; to: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(from)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1400
        const start = performance.now()
        const step = (now: number) => {
          const ease = 1 - Math.pow(1 - Math.min((now - start) / duration, 1), 3)
          setCount(Math.round(from + (to - from) * ease))
          if (ease < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [from, to])
  return <span ref={ref}>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>
}

// ── Social proof strip ────────────────────────────────────────────────────────

export function SocialProofStrip() {
  const items = [
    { icon: '💬', label: 'DMs do Instagram', sub: 'automáticos' },
    { icon: '📊', label: 'Pipeline',          sub: 'visual' },
    { icon: '🤖', label: 'IA nativa',         sub: '24/7' },
    { icon: '🎯', label: 'Meta Ads',           sub: 'integrado' },
    { icon: '🛟', label: 'Suporte 24h',        sub: 'incluído' },
  ]
  return (
    <FadeIn>
      <section className="border-y border-black/5 bg-[#F5F5F7] py-4 overflow-x-auto">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center justify-start sm:justify-center gap-x-4 sm:gap-x-6 gap-y-2 min-w-max sm:min-w-0 sm:flex-wrap">
            {items.map((item, i) => (
              <div key={item.label} className="flex items-center gap-x-4 sm:gap-x-6">
                <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                  <span>{item.icon}</span>
                  <span><strong className="text-[#1D1D1F]">{item.label}</strong> <span className="text-[#6E6E73]">{item.sub}</span></span>
                </span>
                {i < items.length - 1 && <span className="hidden sm:block text-black/15">·</span>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

// ── Platforms comparison ──────────────────────────────────────────────────────

export function PlatformsSection() {
  const tools = [
    { name: 'ManyChat',        category: 'DMs + comentários automáticos', price: 450, icon: '💬', gradient: 'from-orange-400 to-red-500' },
    { name: 'RD Station CRM',  category: 'Pipeline + gestão de leads',    price: 497, icon: '📊', gradient: 'from-blue-400 to-cyan-500' },
    { name: 'ActiveCampaign',  category: 'E-mail + automações',           price: 249, icon: '⚡', gradient: 'from-purple-400 to-violet-500' },
    { name: 'Ferramenta de IA',category: 'Atendente virtual + insights',  price: 299, icon: '🤖', gradient: 'from-emerald-400 to-teal-500' },
  ]
  const total = tools.reduce((sum, t) => sum + t.price, 0)
  const included = [
    'Pipeline Kanban + gestão de leads',
    'WhatsApp Business unificado',
    'DMs e comentários do Instagram',
    'Automações visuais (sem código)',
    'Score IA + Atendente virtual 24/7',
    'Meta Ads + Conversions API',
    'Suporte 24h incluído',
  ]

  return (
    <section className="py-14 sm:py-20 md:py-28 bg-white overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
            Por que Althos CRM
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Você paga mais do que precisa.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#6E6E73] max-w-xl mx-auto">
            Somando as ferramentas comuns, o custo chega a{' '}
            <strong className="text-[#1D1D1F]">R${total.toLocaleString('pt-BR')}/mês</strong>.
            O Althos entrega tudo por muito menos.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start lg:items-center">

          {/* Left: tools being replaced */}
          <FadeIn>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73] mb-4">Antes — ferramentas separadas</p>
              {tools.map(tool => (
                <div key={tool.name} className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] border border-black/5 p-3 sm:p-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-base sm:text-lg text-white shrink-0`}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#6E6E73] line-through decoration-red-400 decoration-2">{tool.name}</p>
                    <p className="text-xs text-[#9E9EA3] leading-tight">{tool.category}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-500 shrink-0 line-through">
                    R${tool.price.toLocaleString('pt-BR')}/mês
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-100 px-4 py-3 mt-2">
                <p className="text-sm font-bold text-red-700">Total mensal</p>
                <p className="text-xl font-bold text-red-600">R${total.toLocaleString('pt-BR')}<span className="text-sm font-normal">/mês</span></p>
              </div>
            </div>
          </FadeIn>

          {/* Right: Althos */}
          <FadeIn delay={0.15}>
            <div className="relative">
              <div className="hidden lg:flex absolute -left-8 top-1/2 -translate-y-1/2 items-center text-[#6E6E73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-[#1D1D1F] p-6 sm:p-8 text-white relative overflow-hidden">
                <div className="pointer-events-none absolute -top-16 -right-16 w-[250px] h-[250px] rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-transparent blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Com Althos CRM</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase">Tudo incluído</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Uma assinatura. Cinco ferramentas.</h3>
                  <ul className="mt-5 space-y-2">
                    {included.map(feature => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-white/80">
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-end gap-2 border-t border-white/10 pt-5">
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">A partir de</p>
                      <div className="flex items-end gap-1.5">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight">R$197</span>
                        <span className="mb-1 text-sm text-white/60">/mês</span>
                      </div>
                      <p className="text-xs text-white/30 mt-0.5">vs R${total.toLocaleString('pt-BR')}/mês separado</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-white/40 mb-0.5">Economia</p>
                      <p className="text-xl sm:text-2xl font-bold text-emerald-400">R${(total - 197).toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-white/30">por mês</p>
                    </div>
                  </div>
                  <Link href="/signup" className="mt-5 block rounded-full bg-white px-6 py-2.5 sm:py-3 text-center text-sm font-semibold text-[#1D1D1F] hover:bg-white/90 transition-all hover:-translate-y-0.5 active:translate-y-0">
                    Começar 7 dias grátis
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ── Stats section ─────────────────────────────────────────────────────────────

export function StatsSection() {
  const stats = [
    { value: 5,    suffix: '',   prefix: '',   label: 'Ferramentas substituídas' },
    { value: 1298, suffix: '+',  prefix: 'R$', label: 'Economizados/mês em média' },
    { value: 47,   suffix: '%',  prefix: '',   label: 'Menos tempo de resposta' },
    { value: 7,    suffix: 'd',  prefix: '',   label: 'Trial grátis · sem cartão' },
  ]
  return (
    <section className="border-y border-black/5 bg-[#F5F5F7] py-10 sm:py-14">
      <FadeInStagger className="mx-auto max-w-4xl px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
        {stats.map(s => (
          <FadeInItem key={s.label}>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1D1D1F]">
              <AnimatedCounter to={s.value} suffix={s.suffix} prefix={s.prefix} />
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6E73] leading-snug">{s.label}</p>
          </FadeInItem>
        ))}
      </FadeInStagger>
    </section>
  )
}

// ── AI section ────────────────────────────────────────────────────────────────

export function AISection() {
  const items = [
    { emoji: '🎯', title: 'Score IA',      badge: 'Pontuação 0–100',     desc: 'Qualifica cada lead automaticamente com uma nota e tier. Priorize seu tempo com quem realmente vai fechar.' },
    { emoji: '🤝', title: 'Atendente IA',  badge: 'Responde como humano', desc: 'Responde WhatsApp, DMs e comentários do Instagram automaticamente. Qualifica leads a qualquer hora, sem você precisar estar online.' },
    { emoji: '💡', title: 'Insights IA',   badge: 'Chat com seus dados',  desc: 'Pergunte qualquer coisa sobre seu negócio em linguagem natural. A IA analisa e responde com dados reais em segundos.' },
    { emoji: '🛟', title: 'Suporte 24h',   badge: 'Sempre disponível',    desc: 'Equipe de suporte disponível 24h por dia, 7 dias por semana. Via chat, WhatsApp e e-mail. Você nunca fica travado.' },
  ]
  return (
    <section className="bg-[#1D1D1F] py-14 sm:py-20 md:py-28 text-white overflow-hidden relative">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-gradient-to-b from-blue-500/10 via-violet-500/5 to-transparent blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            Inteligência Artificial
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            IA que parece humana.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/60 max-w-xl mx-auto">
            Responde clientes, qualifica leads e entrega insights — 24/7, automático.
          </p>
        </FadeIn>
        <FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => (
            <FadeInItem key={item.title}>
              <SpotlightCard className="rounded-2xl sm:rounded-3xl bg-white/5 border border-white/10 p-5 sm:p-6 flex flex-col gap-3 h-full hover:border-white/20 transition-colors duration-300">
                <div className="text-2xl sm:text-3xl">{item.emoji}</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-[13px] sm:text-[15px] text-white/60 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-auto pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-white/40">
                    ✦ {item.badge}
                  </span>
                </div>
              </SpotlightCard>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  )
}

// ── Meta section ──────────────────────────────────────────────────────────────

export function MetaSection() {
  const events = [
    { event: 'PageView',     when: 'Visitante abre o formulário',    color: 'bg-blue-100 text-blue-700' },
    { event: 'Lead',         when: 'Formulário enviado',             color: 'bg-violet-100 text-violet-700' },
    { event: 'Purchase',     when: 'Lead marcado como Ganho',        color: 'bg-emerald-100 text-emerald-700' },
    { event: 'NotQualified', when: 'Score IA → tier Frio',           color: 'bg-red-100 text-red-700' },
  ]
  const bullets = [
    { icon: '📍', text: 'Evento Lead disparado via Pixel e CAPI ao enviar o formulário' },
    { icon: '💰', text: 'Evento Purchase enviado quando o lead chega no estágio Ganho' },
    { icon: '❌', text: 'Evento NotQualified quando a IA classifica o lead como Frio' },
    { icon: '🔗', text: 'UTM source e campaign capturados automaticamente' },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 md:py-28">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 items-center">
        <FadeIn>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
            Tráfego pago
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Feito para quem investe em Meta Ads.
          </h2>
          <p className="mt-3 text-[15px] sm:text-lg text-[#6E6E73] leading-relaxed">
            Integração nativa com Meta Pixel e Conversions API. Cada lead dispara os eventos certos para otimizar suas campanhas.
          </p>
          <FadeInStagger className="mt-6 flex flex-col gap-3">
            {bullets.map(item => (
              <FadeInItem key={item.text} className="flex items-start gap-3">
                <span className="text-lg shrink-0">{item.icon}</span>
                <span className="text-[14px] sm:text-[15px] text-[#3D3D3F] leading-relaxed">{item.text}</span>
              </FadeInItem>
            ))}
          </FadeInStagger>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="rounded-2xl sm:rounded-3xl bg-[#F5F5F7] p-5 sm:p-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73] mb-3">Fluxo de eventos</p>
            {events.map((ev, i) => (
              <motion.div
                key={ev.event}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
                className="flex items-center gap-3 rounded-xl sm:rounded-2xl bg-white border border-black/5 p-3 sm:p-4"
              >
                <span className={`rounded-lg px-2 py-0.5 text-[11px] sm:text-xs font-semibold font-mono shrink-0 ${ev.color}`}>
                  {ev.event}
                </span>
                <span className="text-[13px] sm:text-sm text-[#6E6E73]">{ev.when}</span>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function PricingCard({
  name, price, desc, features, cta, highlight, tag,
}: {
  name: string; price: string; desc: string; features: string[]; cta: string; highlight?: boolean; tag?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col gap-5 h-full ${
        highlight ? 'bg-[#1D1D1F] text-white shadow-2xl shadow-black/20' : 'bg-white border border-black/8 text-[#1D1D1F]'
      }`}
    >
      {tag && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-0.5 text-[11px] font-semibold text-white shadow-lg whitespace-nowrap">
          {tag}
        </span>
      )}
      <div>
        <p className={`text-sm font-medium mb-1 ${highlight ? 'text-white/60' : 'text-[#6E6E73]'}`}>{name}</p>
        <div className="flex items-end gap-1 mb-1.5">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight">{price}</span>
          {price !== 'Grátis' && <span className={`mb-1 text-sm ${highlight ? 'text-white/60' : 'text-[#6E6E73]'}`}>/mês</span>}
        </div>
        <p className={`text-[13px] sm:text-sm ${highlight ? 'text-white/70' : 'text-[#6E6E73]'}`}>{desc}</p>
      </div>
      <ul className="flex flex-col gap-2 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <svg className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className={`text-[13px] sm:text-sm ${highlight ? 'text-white/80' : 'text-[#3D3D3F]'}`}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`rounded-full py-2.5 sm:py-3 text-center text-sm font-semibold transition-all hover:opacity-90 active:scale-95 ${
          highlight ? 'bg-white text-[#1D1D1F]' : 'bg-[#1D1D1F] text-white'
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
      name: 'Trial', price: 'Grátis', desc: '7 dias para explorar tudo. Sem cartão.',
      features: ['Até 50 leads', 'Pipeline Kanban', 'Formulários de captação', 'WhatsApp unificado', 'Tarefas e agendamentos'],
      cta: 'Começar grátis',
    },
    {
      name: 'Starter', price: 'R$ 197', desc: 'Para times que querem escalar.',
      features: ['Até 1.000 leads', 'Tudo do Trial', 'DMs do Instagram + comentários', 'Automações visuais', 'Meta Pixel + CAPI', 'Suporte 24h'],
      cta: 'Assinar Starter', highlight: true, tag: 'Mais popular',
    },
    {
      name: 'Pro', price: 'R$ 397', desc: 'IA completa para alta performance.',
      features: ['Leads ilimitados', 'Tudo do Starter', 'Score IA (0–100)', 'Atendente IA (WhatsApp + Instagram)', 'Insights IA', 'Automações avançadas'],
      cta: 'Assinar Pro',
    },
  ]

  return (
    <section id="planos" className="bg-[#F5F5F7] py-14 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center mb-8 sm:mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
            Planos
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Simples. Sem surpresas.</h2>
          <p className="mt-3 text-base sm:text-lg text-[#6E6E73]">Comece grátis. Menos do que qualquer ferramenta separada.</p>
        </FadeIn>

        {/* Mobile: horizontal scroll. Desktop: grid */}
        <div className="md:hidden flex gap-4 overflow-x-auto pb-4 px-1 snap-x snap-mandatory -mx-4 px-4">
          {plans.map(p => (
            <div key={p.name} className="snap-center shrink-0 w-[80vw] max-w-[300px]">
              <PricingCard {...p} />
            </div>
          ))}
        </div>
        <FadeInStagger className="hidden md:grid grid-cols-3 gap-6 max-w-4xl mx-auto" stagger={0.12}>
          {plans.map(p => (
            <FadeInItem key={p.name}>
              <PricingCard {...p} />
            </FadeInItem>
          ))}
        </FadeInStagger>

        <p className="mt-5 text-center text-xs text-[#6E6E73] md:hidden">← Deslize para ver todos os planos →</p>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-24">
      <FadeIn>
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1D1D1F] via-[#2D2D2F] to-[#1D1D1F] p-8 sm:p-12 md:p-16 text-center text-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[300px] sm:h-[400px] w-[500px] sm:w-[700px] rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-transparent blur-3xl" />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Trial gratuito disponível agora
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
              Pare de pagar por 5 ferramentas separadas.
            </h2>
            <p className="text-[15px] sm:text-lg md:text-xl text-white/60 mb-8 max-w-xl mx-auto">
              Teste 7 dias grátis e veja quanto você economiza com WhatsApp, Instagram, Meta Ads e IA — tudo junto.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-full bg-white px-7 py-3 text-[15px] font-semibold text-[#1D1D1F] hover:bg-white/90 transition-all hover:shadow-lg hover:shadow-white/10 hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Criar conta grátis — 7 dias
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto rounded-full border border-white/20 px-7 py-3 text-[15px] font-semibold text-white hover:bg-white/5 transition-colors text-center"
              >
                Já tenho uma conta
              </Link>
            </div>
            <p className="mt-5 text-xs sm:text-sm text-white/30">Sem cartão de crédito · cancele quando quiser · suporte 24h</p>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
