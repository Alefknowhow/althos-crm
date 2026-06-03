'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const CHECKS = [
  'Atendimento 24h com IA',
  'Automações ilimitadas',
  'Integrações nativas',
  'Dashboards e relatórios avançados',
]

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  const orbY       = useTransform(scrollYProgress, [0, 1], ['0%', '-25%'])
  const dashboardY = useTransform(scrollYProgress, [0, 1], ['0%', '6%'])

  return (
    <section ref={heroRef} className="relative overflow-hidden pt-9 pb-12 sm:pt-20 sm:pb-24 md:pt-28">
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

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* ── Headline + CTA ── */}
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
          className="mx-auto mt-4 max-w-3xl text-[30px] leading-[1.1] sm:mt-5 sm:text-5xl md:text-6xl font-bold tracking-tight text-white"
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
          className="mx-auto mt-3 max-w-xl text-[14px] sm:mt-4 sm:text-lg text-white/55 leading-relaxed"
        >
          Organize seu processo comercial, automatize atendimento e vendas com IA
          e aumente seus resultados todos os dias.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
          className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/signup"
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 text-center"
          >
            Testar grátis por 7 dias
          </Link>
          <span className="text-[13px] text-white/40">Sem cartão de crédito</span>
        </motion.div>

        {/* Checks */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.34 }}
          className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {CHECKS.map(c => (
            <div key={c} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[13px] text-white/70">{c}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Hero illustration ── */}
        <motion.div
          style={{ y: dashboardY }}
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="relative mt-10 sm:mt-14"
        >
          <Image
            src="/hero.jpeg"
            alt="Painel do Althos CRM com atendimento por IA, automações, funil de vendas e relatórios"
            width={1600}
            height={900}
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="h-auto w-full rounded-2xl"
          />
        </motion.div>
      </div>
    </section>
  )
}
