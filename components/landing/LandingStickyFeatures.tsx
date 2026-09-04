'use client'

import { useRef, useState } from 'react'
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion'
import { KanbanMockup, WhatsAppMockup, DMMockup, AutomationMockup, ScoreMockup } from './LandingStickyFeaturesMockups'

// ── Feature list ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '📊', tag: 'Pipeline', color: 'blue',
    title: 'Visualize e mova leads com precisão',
    desc: 'Quadro Kanban com drag-and-drop. Acompanhe o valor total em negociação em tempo real.',
    mockup: <KanbanMockup />,
  },
  {
    icon: '💬', tag: 'WhatsApp', color: 'emerald',
    title: 'Todas as conversas num só inbox',
    desc: 'Responda pelo CRM, veja o histórico completo de cada lead e nunca perca um follow-up. Atendente IA 24/7.',
    mockup: <WhatsAppMockup />,
  },
  {
    icon: '📸', tag: 'Instagram', color: 'pink',
    title: 'DMs e comentários no piloto automático',
    desc: 'A IA responde mensagens e comentários do Instagram como humano. Leads captados direto no CRM.',
    mockup: <DMMockup />,
  },
  {
    icon: '⚡', tag: 'Automações', color: 'violet',
    title: 'Fluxos que trabalham por você',
    desc: 'Sequências disparadas por eventos — formulário, lead movido, tag adicionada. Sem código.',
    mockup: <AutomationMockup />,
  },
  {
    icon: '🎯', tag: 'Score IA', color: 'amber',
    title: 'Priorize quem vai fechar',
    desc: 'A IA gera uma nota de 0 a 100 com classificação Quente, Morno ou Frio para cada lead.',
    mockup: <ScoreMockup />,
  },
] as const

const COLOR_MAP: Record<string, string> = {
  blue:    'text-blue-600 bg-blue-50 border-blue-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  pink:    'text-pink-600 bg-pink-50 border-pink-100',
  violet:  'text-violet-600 bg-violet-50 border-violet-100',
  amber:   'text-amber-600 bg-amber-50 border-amber-100',
}

// ── Mobile: simple stacked cards ─────────────────────────────────────────────

function MobileFeatures() {
  return (
    <section id="funcionalidades" className="md:hidden bg-white py-14 px-4">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
          Funcionalidades
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Cinco ferramentas.<br />Um sistema.</h2>
        <p className="mt-2 text-base text-[#6E6E73]">Sem integrações quebradas. Sem assinaturas extras.</p>
      </div>
      <div className="flex flex-col gap-3">
        {FEATURES.map((f, i) => {
          const colorClass = COLOR_MAP[f.color]
          return (
            <motion.div
              key={f.tag}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
              className="flex items-start gap-3 rounded-2xl border border-black/6 bg-white p-4 shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${colorClass}`}>
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass.split(' ')[0]}`}>{f.tag}</span>
                <p className="text-[14px] font-semibold text-[#1D1D1F] leading-snug mt-0.5">{f.title}</p>
                <p className="text-[13px] text-[#6E6E73] mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ── Desktop: sticky scroll ────────────────────────────────────────────────────

function DesktopStickyFeatures() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(FEATURES.length - 1, Math.floor(v * FEATURES.length)))
  })

  return (
    <section
      id="funcionalidades-desktop"
      ref={sectionRef}
      style={{ minHeight: `${FEATURES.length * 100}vh` }}
      className="relative hidden md:block"
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden bg-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10 px-6"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
            Funcionalidades
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Cinco ferramentas. Um sistema.
          </h2>
          <p className="mt-3 text-lg text-[#6E6E73]">Sem integrações quebradas. Sem assinaturas extras.</p>
        </motion.div>

        <div className="mx-auto w-full max-w-6xl px-6 grid grid-cols-2 gap-16 items-center">
          {/* Left: feature list */}
          <div className="flex flex-col gap-3">
            {FEATURES.map((f, i) => {
              const isActive = i === active
              const colorClass = COLOR_MAP[f.color]
              return (
                <motion.div
                  key={f.tag}
                  animate={{ opacity: isActive ? 1 : 0.35, x: isActive ? 0 : -4 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4 rounded-2xl p-4 cursor-default"
                  style={{ background: isActive ? 'rgba(0,0,0,0.02)' : 'transparent' }}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${colorClass}`}>
                    {f.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass.split(' ')[0]}`}>{f.tag}</span>
                    <p className="text-[15px] font-semibold text-[#1D1D1F] leading-snug">{f.title}</p>
                    {isActive && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="mt-1.5 text-sm text-[#6E6E73] leading-relaxed"
                      >
                        {f.desc}
                      </motion.p>
                    )}
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="feature-dot"
                      className={`w-2 h-2 rounded-full shrink-0 mt-4 ${colorClass.split(' ')[0].replace('text-', 'bg-')}`}
                    />
                  )}
                </motion.div>
              )
            })}
            <div className="mt-4 h-1 rounded-full bg-black/5 overflow-hidden">
              <motion.div
                style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-pink-500 to-violet-500"
              />
            </div>
          </div>

          {/* Right: mockup */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {FEATURES[active].mockup}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Exported component ────────────────────────────────────────────────────────

export function LandingStickyFeatures() {
  return (
    <>
      <MobileFeatures />
      <DesktopStickyFeatures />
    </>
  )
}
