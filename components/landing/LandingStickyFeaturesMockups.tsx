'use client'

/**
 * Static UI mockups used by LandingStickyFeatures's feature list (Kanban,
 * WhatsApp, Instagram DM, Automation, Score). Split out of
 * LandingStickyFeatures.tsx.
 */

import { motion } from 'framer-motion'

export function KanbanMockup() {
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

export function WhatsAppMockup() {
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

export function DMMockup() {
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
          <p className="text-[10px] text-[#6E6E73]"><span className="font-semibold" style={{ color: '#833AB4' }}>@usuario_joao:</span> &quot;Tem teste?&quot;</p>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: '#E1306C' }}>↳ IA: &quot;Sim! Te mandei no privado 😊&quot;</p>
        </div>
      </div>
    </div>
  )
}

export function AutomationMockup() {
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

export function ScoreMockup() {
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
