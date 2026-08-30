'use client'

import { useState } from 'react'

export default function AiCreditsTabs({
  consumption,
  pricing,
}: {
  consumption: React.ReactNode
  pricing: React.ReactNode
}) {
  const [tab, setTab] = useState<'consumo' | 'precificacao'>('consumo')

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
        <button
          onClick={() => setTab('consumo')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'consumo' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Consumo
        </button>
        <button
          onClick={() => setTab('precificacao')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'precificacao' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Precificação
        </button>
      </div>
      <div className={tab === 'consumo' ? '' : 'hidden'}>{consumption}</div>
      <div className={tab === 'precificacao' ? '' : 'hidden'}>{pricing}</div>
    </div>
  )
}
