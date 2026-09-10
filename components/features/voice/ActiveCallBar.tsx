'use client'

import { useEffect, useState } from 'react'
import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { useActiveCall } from './ActiveCallProvider'

function useElapsed(startedAt: number): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.floor((now - startedAt) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Barra persistente da chamada ativa — montada no layout, some quando não há chamada. */
export function ActiveCallBar() {
  const { activeCall, hangup, toggleMute } = useActiveCall()
  if (!activeCall) return null
  return <ActiveCallBarContent name={activeCall.name} startedAt={activeCall.startedAt} muted={activeCall.muted} onHangup={hangup} onToggleMute={toggleMute} />
}

function ActiveCallBarContent({ name, startedAt, muted, onHangup, onToggleMute }: {
  name: string; startedAt: number; muted: boolean; onHangup: () => void; onToggleMute: () => void
}) {
  const elapsed = useElapsed(startedAt)
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border bg-card shadow-lg px-4 py-2.5">
      <div>
        <div className="text-sm font-medium leading-tight">{name}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{elapsed}</div>
      </div>
      <button
        type="button"
        onClick={onToggleMute}
        className={`h-8 w-8 flex items-center justify-center rounded-full ${muted ? 'bg-amber-500/10 text-amber-600' : 'hover:bg-muted text-muted-foreground'}`}
        aria-label={muted ? 'Ativar microfone' : 'Silenciar'}
      >
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onHangup}
        className="h-8 w-8 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
        aria-label="Encerrar ligação"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  )
}
