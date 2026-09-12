'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setModuleEnabled } from '@/actions/super-admin'
import type { NicheKey } from '@/lib/niche'
import type { ModuleKey } from '@/lib/niche-modules'
import type { ModuleFlags } from '@/lib/module-flags'

const NICHE_LABELS: Record<NicheKey, string> = {
  viagens: 'Agência de Viagens',
  clinicas: 'Clínicas',
  imoveis: 'Imobiliárias',
  seguros: 'Corretora de Seguros',
  trafego: 'Agência de Tráfego',
  advocacia: 'Jurídico',
}

const NICHE_ORDER: NicheKey[] = ['viagens', 'clinicas', 'imoveis', 'seguros', 'trafego', 'advocacia']

export default function ModuleFlagsEditor({
  groups, disabled,
}: {
  groups: Record<NicheKey, { key: ModuleKey; label: string }[]>
  disabled: ModuleFlags
}) {
  const router = useRouter()
  const [niche, setNiche] = useState<NicheKey>('viagens')
  const [pending, startTransition] = useTransition()
  const [pendingKey, setPendingKey] = useState<ModuleKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const modules = groups[niche] ?? []
  const disabledSet = new Set(disabled[niche] ?? [])

  function toggle(moduleKey: ModuleKey, nextEnabled: boolean) {
    setError(null)
    setPendingKey(moduleKey)
    startTransition(async () => {
      const res = await setModuleEnabled(niche, moduleKey, nextEnabled)
      if (!res.ok) { setError(res.error); setPendingKey(null); return }
      setPendingKey(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="w-64">
        <label className="text-xs text-slate-500 mb-1 block">Nicho</label>
        <select
          value={niche}
          onChange={e => setNiche(e.target.value as NicheKey)}
          className="w-full rounded-md border border-white/10 bg-[#0f0f11] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          {NICHE_ORDER.map(n => <option key={n} value={n}>{NICHE_LABELS[n]}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {modules.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Nenhum módulo dedicado cadastrado pra esse nicho ainda.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {modules.map(m => {
              const enabled = !disabledSet.has(m.key)
              const isThisPending = pending && pendingKey === m.key
              return (
                <div key={m.key} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{m.label}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{m.key}</p>
                  </div>
                  <button
                    onClick={() => toggle(m.key, !enabled)}
                    disabled={isThisPending}
                    title={enabled ? 'Desativar globalmente' : 'Ativar globalmente'}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      enabled ? 'bg-violet-600' : 'bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
