'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const PLATFORMS = [
  { label: 'ManyChat',       icon: '💬' },
  { label: 'RD Station',     icon: '📊' },
  { label: 'ActiveCampaign', icon: '⚡' },
  { label: 'Meta Ads',       icon: '🎯' },
]

const KANBAN_COLUMNS = [
  { stage: 'Novo',       count: 8,  color: 'bg-blue-500',    leads: ['João Silva', 'Maria Costa'] },
  { stage: 'Em contato', count: 5,  color: 'bg-amber-500',   leads: ['Ana Lima', 'Carlos Souza'] },
  { stage: 'Proposta',   count: 3,  color: 'bg-violet-500',  leads: ['Bruno Oliveira'] },
  { stage: 'Ganho',      count: 2,  color: 'bg-emerald-500', leads: ['Rafael Melo', 'Camila'] },
]

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  const orbY             = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const dashboardY       = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])
  const dashboardOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-gradient-to-b from-white via-white to-[#F5F5F7] pb-16 pt-14 sm:pb-24 sm:pt-20 md:pb-32 md:pt-28 text-center"
    >
      {/* Parallax orb */}
      <motion.div
        style={{ y: orbY }}
        className="pointer-events-none absolute inset-0 flex items-start justify-center"
      >
        <div className="h-[500px] w-[800px] sm:h-[700px] sm:w-[1000px] rounded-full bg-gradient-to-br from-blue-100/70 via-violet-100/50 to-transparent blur-3xl" />
      </motion.div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] sm:text-xs font-medium text-[#1D1D1F] shadow-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Trial grátis · 7 dias · sem cartão de crédito
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mt-5 text-[32px] leading-[1.15] sm:text-5xl sm:leading-tight md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          Troque 5 ferramentas{' '}
          <span className="bg-gradient-to-br from-blue-600 via-violet-500 to-blue-400 bg-clip-text text-transparent">
            por um sistema só.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="mx-auto mt-4 max-w-2xl text-[15px] sm:text-lg md:text-xl text-[#6E6E73] leading-relaxed"
        >
          Pipeline, WhatsApp, DMs do Instagram, Meta Ads e IA — tudo integrado num único CRM,
          com suporte 24h.
        </motion.p>

        {/* Platforms replaced strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
        >
          <span className="text-[11px] text-[#6E6E73]">Substitui:</span>
          {PLATFORMS.map(p => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73]"
            >
              {p.icon} {p.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73]">
            🤖 IA nativa
          </span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/signup"
            className="w-full sm:w-auto rounded-full bg-[#1D1D1F] px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-black/20 hover:bg-[#3D3D3F] transition-all hover:shadow-xl hover:shadow-black/25 hover:-translate-y-0.5 active:translate-y-0 text-center"
          >
            Começar gratuitamente
          </Link>
          <Link
            href="#funcionalidades"
            className="w-full sm:w-auto rounded-full border border-black/15 px-7 py-3 text-[15px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-all hover:border-black/25 text-center"
          >
            Ver funcionalidades ↓
          </Link>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          style={{ y: dashboardY, opacity: dashboardOpacity }}
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
          className="mt-10 sm:mt-16 mx-auto max-w-5xl"
        >
          <div className="rounded-2xl border border-black/8 bg-white shadow-2xl shadow-black/10 overflow-hidden ring-1 ring-black/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-black/5 bg-[#F5F5F7] px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-2 sm:mx-4">
                <div className="rounded-md bg-white border border-black/8 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-[#6E6E73] text-center">
                  app.althos.io/pipeline
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-[#6E6E73] shrink-0">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> IA</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> WhatsApp</span>
              </div>
            </div>

            {/* Kanban — 2 cols on mobile, 4 on sm+ */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.55 } } }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-6 bg-[#F5F5F7]/50"
            >
              {KANBAN_COLUMNS.map((col, colIdx) => (
                <motion.div
                  key={col.stage}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
                  className={`flex flex-col gap-1.5 sm:gap-2 ${colIdx >= 2 ? 'hidden sm:flex' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1">
                    <div className={`w-2 h-2 rounded-full ${col.color}`} />
                    <span className="text-[11px] sm:text-xs font-semibold text-[#1D1D1F]">{col.stage}</span>
                    <span className="ml-auto text-[10px] sm:text-xs text-[#6E6E73]">{col.count}</span>
                  </div>
                  {col.leads.map((name, i) => (
                    <motion.div
                      key={name}
                      variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3, delay: i * 0.05 } } }}
                      className="rounded-lg sm:rounded-xl bg-white border border-black/6 p-2 sm:p-3 shadow-sm"
                    >
                      <div className="text-[10px] sm:text-xs font-medium text-[#1D1D1F] mb-1">{name}</div>
                      <div className="flex items-center gap-1">
                        <div className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold text-emerald-700">HOT</div>
                        <div className="text-[8px] sm:text-[9px] text-[#6E6E73]">87</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
