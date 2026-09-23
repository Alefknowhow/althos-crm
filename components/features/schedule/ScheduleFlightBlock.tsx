'use client'

/**
 * Bloco de voo (ida ou volta) da lista de Embarques — layout definitivo da
 * issue #9 § 3.4/3.5: indicador de verificação + rota em destaque + ícone de
 * localizador na linha 1, horários 24h com +1/+2 na linha 2, companhia +
 * conexão na linha 3. Extraído de ScheduleTripRow.tsx.
 */

import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ClipboardCopy } from 'lucide-react'
import { toast } from 'sonner'
import type { FlightLegInfo } from '@/actions/travel-schedule'
import { verifyFlight, type FlightVerifyResult } from './flight-verify'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtTime(hhmm?: string | null): string {
  if (!hhmm) return '--:--'
  const m = /^(\d{2}):(\d{2})/.exec(hhmm)
  return m ? `${m[1]}:${m[2]}` : hhmm
}

/** "Direto" / "N conexões" — sem listar os aeroportos de escala (fora do
 *  escopo desta linha; detalhes completos ficam em Produtos). */
function connectionLabel(legs: FlightLegInfo[]): string {
  const stops = legs.length - 1
  if (stops <= 0) return 'Direto'
  return `${stops} conexão${stops > 1 ? 'ões' : ''}`
}

const VERIFY_DOT: Record<FlightVerifyResult['state'], string> = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  neutral: 'bg-muted-foreground/40',
}

function VerifyIndicator({ result }: { result: FlightVerifyResult | null }) {
  if (!result) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={result.summary}
          className={cn('inline-block w-2 h-2 rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', VERIFY_DOT[result.state])}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {result.lines.map((line, i) => <p key={i}>{line}</p>)}
      </TooltipContent>
    </Tooltip>
  )
}

function LocatorButton({ locator }: { locator: string | null }) {
  if (!locator) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Copiar localizador ${locator}`}
          onClick={e => {
            e.stopPropagation()
            navigator.clipboard.writeText(locator).then(() => toast.success('Localizador copiado.'))
          }}
          className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ClipboardCopy className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Localizador: {locator}</TooltipContent>
    </Tooltip>
  )
}

/** Bloco de voo (ida ou volta) — 3 linhas fixas:
 *  1. indicador de verificação · rota em destaque · ícone de localizador
 *  2. horário de saída – horário de chegada (+1/+2 quando cruza a virada)
 *  3. companhia · conexão */
export function FlightBlock({ legs, locator }: { legs: FlightLegInfo[]; locator: string | null }) {
  if (legs.length === 0) return <span className="text-xs text-muted-foreground">—</span>

  const first = legs[0]
  const last = legs[legs.length - 1]
  const arrivalDate = last.data_chegada || last.data
  const depParsed = parseDate(first.data)
  const arrParsed = parseDate(arrivalDate)
  const nextDayDiff = depParsed && arrParsed ? Math.round((arrParsed.getTime() - depParsed.getTime()) / 86400000) : 0
  const verify = verifyFlight(legs)
  const webCheckin = Array.from(new Set(legs.map(l => l.localizador).filter(Boolean))).join(' + ') || null
  const badgeLocator = webCheckin || locator

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-w-[168px] text-xs space-y-0.5">
        <div className="flex items-center gap-1.5">
          <VerifyIndicator result={verify} />
          <span className="font-semibold text-foreground tabular-nums">
            {first.origem || '—'} → {last.destino || '—'}
          </span>
          <LocatorButton locator={badgeLocator} />
        </div>
        <div className="tabular-nums text-muted-foreground">
          {fmtTime(first.horario)} – {fmtTime(last.horario_chegada)}
          {nextDayDiff > 0 && <sup className="text-primary font-semibold ml-0.5">+{nextDayDiff}</sup>}
        </div>
        <div className="text-muted-foreground truncate">
          {first.companhia || 'Cia não informada'} · {connectionLabel(legs)}
        </div>
      </div>
    </TooltipProvider>
  )
}
