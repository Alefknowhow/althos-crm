'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const CHECKS = [
  'Atendimento 24h com IA',
  'Automações ilimitadas',
  'Integrações nativas',
  'Dashboards e relatórios avançados',
]

const KPIS = [
  { label: 'Novos Leads',      value: '2.450',     delta: '+15%' },
  { label: 'Oportunidades',     value: '842',       delta: '+12%' },
  { label: 'Vendas',            value: 'R$ 128.690', delta: '' },
  { label: 'Taxa de Conversão', value: '32,6%',     delta: '+8%' },
]

const SIDEBAR = ['Dashboard', 'Leads', 'Pipelines', 'Atendimentos', 'Automação', 'Tarefas', 'Relatórios', 'Configurações']

const DONUT = [
  { label: 'Instagram',    pct: 45, color: '#8B5CF6' },
  { label: 'Facebook Ads', pct: 30, color: '#3B82F6' },
  { label: 'Google Ads',   pct: 15, color: '#22D3EE' },
  { label: 'Orgânico',     pct: 10, color: '#475569' },
]

const ATTENDANCES = [
  { name: 'João Silva',     msg: 'Quero mais informações sobre o serviço', ch: 'Instagram' },
  { name: 'Maria Santos',   msg: 'Qual o valor e formas de pagamento?',    ch: 'WhatsApp' },
  { name: 'Pedro Oliveira', msg: 'Gostaria de agendar uma demonstração',   ch: 'Site' },
]

// Build the SVG arc path string for the area chart
const CHART_POINTS = [22, 30, 26, 38, 34, 48, 44, 58, 52, 68, 62, 78]

function MiniDashboard() {
  // donut stroke-dasharray maths
  const circumference = 2 * Math.PI * 15.9
  let offsetAcc = 0

  const max = Math.max(...CHART_POINTS)
  const path = CHART_POINTS
    .map((v, i) => `${(i / (CHART_POINTS.length - 1)) * 100},${40 - (v / max) * 34}`)
    .join(' ')

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl shadow-black/60 overflow-hidden ring-1 ring-white/5">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-[#0A0F1C] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-blue-700 text-white text-[9px] font-black">A</span>
          <span className="text-[11px] font-semibold text-white">ALTHOS <span className="text-white/40 font-normal">CRM</span></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block rounded-md bg-white/5 border border-white/8 px-2 py-1 text-[9px] text-white/40 w-28">Buscar…</div>
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-violet-500" />
        </div>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden sm:flex flex-col gap-0.5 w-28 shrink-0 border-r border-white/8 bg-[#0A0F1C] p-2">
          {SIDEBAR.map((item, i) => (
            <div
              key={item}
              className={`rounded-md px-2 py-1.5 text-[9px] font-medium ${
                i === 0 ? 'bg-blue-600/20 text-blue-300' : 'text-white/40'
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        {/* main */}
        <div className="flex-1 p-3 space-y-3 min-w-0">
          <p className="text-[11px] font-semibold text-white">Dashboard</p>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2">
            {KPIS.map(k => (
              <div key={k.label} className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <p className="text-[8px] text-white/40 truncate">{k.label}</p>
                <div className="flex items-end gap-1">
                  <p className="text-[13px] font-bold text-white tracking-tight">{k.value}</p>
                  {k.delta && <span className="text-[8px] font-semibold text-emerald-400 mb-0.5">{k.delta}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* chart + donut */}
          <div className="grid grid-cols-5 gap-2">
            {/* area chart */}
            <div className="col-span-3 rounded-lg border border-white/8 bg-white/[0.03] p-2">
              <p className="text-[8px] text-white/40 mb-1">Vendas · últimos 30 dias</p>
              <svg viewBox="0 0 100 40" className="w-full h-14" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="heroChart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points={path} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points={`0,40 ${path} 100,40`} fill="url(#heroChart)" />
              </svg>
            </div>

            {/* donut */}
            <div className="col-span-2 rounded-lg border border-white/8 bg-white/[0.03] p-2">
              <p className="text-[8px] text-white/40 mb-1">Leads por origem</p>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90 shrink-0">
                  {DONUT.map(d => {
                    const len = (d.pct / 100) * circumference
                    const seg = (
                      <circle
                        key={d.label}
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={d.color} strokeWidth="4"
                        strokeDasharray={`${len} ${circumference - len}`}
                        strokeDashoffset={-offsetAcc}
                      />
                    )
                    offsetAcc += len
                    return seg
                  })}
                </svg>
                <div className="space-y-0.5 min-w-0">
                  {DONUT.map(d => (
                    <div key={d.label} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-[7px] text-white/50 truncate">{d.label}</span>
                      <span className="text-[7px] text-white/30 ml-auto">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* attendances */}
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2 space-y-1.5">
            <p className="text-[8px] text-white/40">Atendimentos em andamento</p>
            {ATTENDANCES.map(a => (
              <div key={a.name} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[8px] font-semibold text-white/70 shrink-0">
                  {a.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-medium text-white/80 truncate">{a.name}</p>
                  <p className="text-[7px] text-white/35 truncate">{a.msg}</p>
                </div>
                <span className="text-[7px] text-white/30 shrink-0">{a.ch}</span>
                <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-400 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" /> Online
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  const orbY       = useTransform(scrollYProgress, [0, 1], ['0%', '-25%'])
  const dashboardY = useTransform(scrollYProgress, [0, 1], ['0%', '6%'])

  return (
    <section ref={heroRef} className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 md:pt-28">
      {/* Parallax glow orbs */}
      <motion.div style={{ y: orbY }} className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute -top-20 right-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
      </motion.div>
      {/* grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">

          {/* ── Left column ── */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] sm:text-xs font-medium text-blue-300">
                ✦ CRM completo com IA e automações
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="mt-5 text-[34px] leading-[1.1] sm:text-5xl md:text-6xl font-bold tracking-tight text-white"
            >
              Transforme mais{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">leads</span>
              {' '}em{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">clientes</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
              className="mx-auto lg:mx-0 mt-4 max-w-xl text-[15px] sm:text-lg text-white/55 leading-relaxed"
            >
              Organize seu processo comercial, automatize atendimento e vendas com IA
              e aumente seus resultados todos os dias.
            </motion.p>

            {/* Checks */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
              className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto lg:mx-0"
            >
              {CHECKS.map(c => (
                <div key={c} className="flex items-center gap-2 text-left">
                  <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[13px] text-white/70">{c}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.34 }}
              className="mt-7 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3"
            >
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Testar grátis por 7 dias
              </Link>
              <span className="text-[13px] text-white/40">Sem cartão de crédito</span>
            </motion.div>

            {/* Avatars + rating */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
              className="mt-7 flex items-center justify-center lg:justify-start gap-3"
            >
              <div className="flex -space-x-2">
                {['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981'].map((c, i) => (
                  <span key={i} className="h-8 w-8 rounded-full border-2 border-[#0A0E1A]" style={{ background: c }} />
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-0.5 text-amber-400 text-xs">★★★★★</div>
                <p className="text-[11px] text-white/45">Mais de 1.000 empresas já transformam seus resultados com o Althos.</p>
              </div>
            </motion.div>
          </div>

          {/* ── Right column: dashboard ── */}
          <motion.div
            style={{ y: dashboardY }}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="relative"
          >
            <MiniDashboard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
