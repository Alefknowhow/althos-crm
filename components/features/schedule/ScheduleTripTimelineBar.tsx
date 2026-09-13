'use client'

/**
 * Barra "Ida → Volta" com avião nas pontas e o destino+período no meio —
 * guiada pelo anexo 3 do redesign de Embarques. O trecho central tem uma
 * animação sutil (gradiente deslizante) simbolizando a viagem em curso;
 * o nome do cliente fica centralizado dentro dela.
 */

import { Plane } from 'lucide-react'

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtShort(d: Date | null) {
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}.`
}

export function ScheduleTripTimelineBar({
  departure, returnDate, destination, clientName,
}: {
  departure: Date | null
  returnDate: Date | null
  destination?: string | null
  clientName?: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-16">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
          <Plane className="w-3.5 h-3.5" />
        </span>
        <span className="text-[10px] text-muted-foreground text-center leading-tight">{fmtShort(departure)}<br />Ida</span>
      </div>

      <div className="relative flex-1 h-7 rounded-pill bg-primary/10 overflow-hidden">
        <div
          className="absolute inset-0 animate-timeline-shimmer motion-reduce:animate-none"
          style={{
            backgroundImage: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.25), transparent)',
            backgroundSize: '200% 100%',
          }}
        />
        <div className="relative h-full flex items-center justify-center px-2">
          <span className="text-[11px] font-medium text-primary truncate">
            {clientName ? clientName : [destination, departure && returnDate ? `${fmtShort(departure)} — ${fmtShort(returnDate)}` : null].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 shrink-0 w-16">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
          <Plane className="w-3.5 h-3.5 rotate-180" />
        </span>
        <span className="text-[10px] text-muted-foreground text-center leading-tight">{fmtShort(returnDate)}<br />Volta</span>
      </div>
    </div>
  )
}
