'use client'

import { useRef, useState } from 'react'
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion'

// ── Mockups ───────────────────────────────────────────────────────────────────

function KanbanMockup() {
  const cols = [
    { label: 'Novo',     color: 'bg-blue-500',    cards: ['João Silva · R$4.800', 'Maria Costa · R$12k'] },
    { label: 'Proposta', color: 'bg-violet-500',   cards: ['Bruno Oliveira · R$8.500'] },
    { label: 'Ganho',    color: 'bg-emerald-500',  cards: ['Rafael Melo · R$6k', 'Camila · R$9.200'] },
  ]
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-xl p-4 sm:p-5">
      <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3 sm:mb-4">Pipeline · Julho</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cols.map(col => (
          <div key={col.label}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-[11px] font-semibold text-[#1D1D1F]">{col.label}</span>
            </div>
            {col.cards.map(c => (
              <div key={c} className="rounded-lg bg-[#F5F5F7] border border-black/5 p-2 sm:p-2.5 mb-1.5 sm:mb-2">
                <p className="text-[10px] sm:text-[11px] font-medium text-[#1D1D1F] leading-tight">{c.split('·')[0]}</p>
                <p className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold mt-0.5">{c.split('·')[1]?.trim()}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WhatsAppMockup() {
  const msgs = [
    { text: 'Olá, quero saber mais sobre o plano Pro!', time: '14:32', mine: false },
    { text: 'Oi João! Claro, você prefere uma demo ao vivo?', time: '14:34', mine: true },
    { text: 'Sim! Amanhã às 10h funciona?', time: '14:35', mine: false },
  ]
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-[#F5F5F7]">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-700 shrink-0">J</div>
        <div>
          <p className="text-sm font-semibold text-[#1D1D1F]">João Silva</p>
          <p className="text-[10px] text-emerald-500 font-medium">● Online</p>
        </div>
        <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 shrink-0">HOT 92</span>
      </div>
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 bg-[#FAFAFA]">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.mine ? 'bg-[#1D1D1F] text-white' : 'bg-white border border-black/8 text-[#1D1D1F]'}`}>
              <p className="text-[11px] leading-relaxed">{m.text}</p>
              <p className={`text-[9px] mt-1 ${m.mine ? 'text-white/50' : 'text-[#6E6E73]'}`}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DMMockup() {
  const msgs = [
    { text: 'Vi o post de vocês! Quanto custa?', time: '10:42', mine: false },
    { text: 'Oi Ana! 😊 Planos a partir de R$197/mês. Posso te enviar o link do trial?', time: '10:42', mine: true, ai: true },
    { text: 'Sim, manda! 👍', time: '10:43', mine: false },
  ]
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-gradient-to-r from-[#fdf0f8] to-[#f5f0ff]">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
        >IG</div>
        <div>
          <p className="text-sm font-semibold text-[#1D1D1F]">@ana.cliente</p>
          <p className="text-[10px] font-medium" style={{ color: '#E1306C' }}>Instagram Direct</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">IA ativa</span>
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 bg-[#FAFAFA]">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.mine ? 'text-white' : 'bg-white border border-black/8 text-[#1D1D1F]'}`}
              style={m.mine ? { background: 'linear-gradient(135deg, #E1306C, #833AB4)' } : {}}
            >
              <p className="text-[11px] leading-relaxed">{m.text}</p>
              <div className={`flex items-center gap-1 mt-1 ${m.mine ? 'justify-end' : ''}`}>
                {m.ai && <span className="text-[8px] text-white/60">✦ IA ·</span>}
                <span className={`text-[9px] ${m.mine ? 'text-white/50' : 'text-[#6E6E73]'}`}>{m.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 p-3">
        <p className="text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Comentário respondido</p>
        <div className="rounded-xl p-2.5 border" style={{ background: 'linear-gradient(to right, #fdf0f8, #f5f0ff)', borderColor: '#f0d0f0' }}>
          <p className="text-[10px] text-[#6E6E73]"><span className="font-semibold" style={{ color: '#833AB4' }}>@usuario_joao:</span> "Tem teste?"</p>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: '#E1306C' }}>↳ IA: "Sim! Te mandei no privado 😊"</p>
        </div>
      </div>
    </div>
  )
}

function AutomationMockup() {
  const nodes = [
    { label: 'Formulário enviado', icon: '📋', color: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: 'Score IA gerado',    icon: '🤖', color: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: 'Aguardar 1h',        icon: '⏱',  color: 'border-gray-200 bg-gray-50 text-gray-600' },
    { label: 'Enviar WhatsApp',    icon: '💬', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ]
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-xl p-4 sm:p-5">
      <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3 sm:mb-4">Fluxo · Novo Lead</p>
      <div className="flex flex-col items-center gap-0">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center w-full">
            <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 w-full ${n.color}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[12px] font-semibold">{n.label}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-current opacity-40" />
            </div>
            {i < nodes.length - 1 && <div className="w-px h-4 bg-gradient-to-b from-gray-200 to-gray-300 my-0.5" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreMockup() {
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-xl p-4 sm:p-5">
      <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3 sm:mb-4">Score IA · Maria Costa</p>
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <p className="text-4xl sm:text-5xl font-bold text-[#1D1D1F] tracking-tight">87</p>
          <span className="inline-flex mt-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">🔥 QUENTE</span>
        </div>
        <div className="relative w-20 h-20 sm:w-24 sm:h-24">
          <svg className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F0F0F5" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#sg2)" strokeWidth="3"
              strokeDasharray={`${87 * 0.9975} ${100 - 87 * 0.9975}`} strokeLinecap="round" />
            <defs>
              <linearGradient id="sg2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-[#1D1D1F]">87%</span>
          </div>
        </div>
      </div>
      {[
        { label: 'Engajamento', val: 95 },
        { label: 'Perfil decisor', val: 82 },
        { label: 'Urgência', val: 78 },
      ].map(f => (
        <div key={f.label} className="mb-2">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-[#6E6E73]">{f.label}</span>
            <span className="text-[11px] font-semibold text-[#1D1D1F]">{f.val}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F5F5F7] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${f.val}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

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
