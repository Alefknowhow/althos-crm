'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSystemConfig, type SystemConfigRow } from '@/actions/super-admin'
import { Check, RotateCcw } from 'lucide-react'

export default function ConfigEditor({ row }: { row: SystemConfigRow }) {
  const router = useRouter()
  const original = JSON.stringify(row.value)
  const [value, setValue] = useState(original)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = value !== original
  const isBool = typeof row.value === 'boolean'

  function save(nextRaw?: string) {
    const raw = nextRaw ?? value
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateSystemConfig(row.key, raw)
      if (!res.ok) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-semibold text-white">{row.key}</p>
        {row.description && <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>}
      </div>

      <div className="w-72 shrink-0">
        {isBool ? (
          <div className="flex justify-end">
            <button
              onClick={() => { const next = value === 'true' ? 'false' : 'true'; setValue(next); save(next) }}
              disabled={pending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                value === 'true' ? 'bg-violet-600' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              rows={value.length > 40 ? 4 : 1}
              spellCheck={false}
              className="w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-xs font-mono text-white focus:border-violet-500 focus:outline-none resize-y"
            />
            {dirty && (
              <div className="flex items-center gap-2 mt-1.5 justify-end">
                <button
                  onClick={() => { setValue(original); setError(null) }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/5"
                >
                  <RotateCcw className="w-3 h-3" /> Reverter
                </button>
                <button
                  onClick={() => save()}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Salvar
                </button>
              </div>
            )}
          </>
        )}
        {error && <p className="text-[11px] text-red-400 mt-1 text-right">{error}</p>}
        {saved && !dirty && !error && <p className="text-[11px] text-emerald-400 mt-1 text-right">Salvo</p>}
      </div>
    </div>
  )
}
