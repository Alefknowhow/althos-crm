'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateReferralStatus } from '@/actions/super-admin'
import { CheckCircle2, Award } from 'lucide-react'

export default function ReferralActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(next: 'converted' | 'rewarded') {
    setError(null)
    startTransition(async () => {
      const res = await updateReferralStatus(id, next)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }

  if (status === 'rewarded') {
    return <span className="text-[11px] text-emerald-400">Concluído</span>
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {status === 'pending' && (
        <button
          onClick={() => run('converted')}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-sky-800/40 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900/40 disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" /> Converter
        </button>
      )}
      <button
        onClick={() => run('rewarded')}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-800/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
      >
        <Award className="w-3 h-3" /> Premiar
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}
