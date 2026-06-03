'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateAlertStatus } from '@/actions/super-admin'
import { Check, CheckCheck } from 'lucide-react'

export default function AlertActions({
  alertId,
  status,
}: {
  alertId: string
  status: 'open' | 'acknowledged' | 'resolved'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  if (status === 'resolved') {
    return <span className="text-[11px] text-emerald-400 font-medium">Resolvido</span>
  }

  function run(next: 'acknowledged' | 'resolved') {
    setErr(null)
    startTransition(async () => {
      const res = await updateAlertStatus(alertId, next)
      if (!res.ok) { setErr(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === 'open' && (
        <button
          onClick={() => run('acknowledged')}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 disabled:opacity-50"
        >
          <Check className="w-3 h-3" /> Reconhecer
        </button>
      )}
      <button
        onClick={() => run('resolved')}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-800/50 bg-emerald-950/50 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-950/80 disabled:opacity-50"
      >
        <CheckCheck className="w-3 h-3" /> Resolver
      </button>
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </div>
  )
}
