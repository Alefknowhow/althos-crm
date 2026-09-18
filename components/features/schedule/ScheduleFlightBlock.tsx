'use client'

/**
 * Bloco de voo (ida ou volta) da tabela de Gestão de Viagens — extraído de
 * ScheduleTripRow.tsx só pra não estourar o limite de linhas do arquivo.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ClipboardCopy } from 'lucide-react'
import { toast } from 'sonner'
import type { FlightLegInfo } from '@/actions/travel-schedule'
import { FLIGHT_STATUS_META } from './ScheduleTripDetail'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtShort(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'
}

/** Círculo com as iniciais da companhia — substitui o logotipo (não há
 *  base de logos de companhias aéreas no Althos; a cia é texto livre). */
function AirlineMark({ name }: { name: string | null }) {
  const initials = (name || '—').trim().slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
      {initials}
    </span>
  )
}

function connectionLabel(legs: FlightLegInfo[]): string | null {
  const stops = legs.length > 1
    ? legs.slice(0, -1).map((l, i) => legs[i + 1].conexao_local || l.destino).filter(Boolean)
    : (legs[0]?.conexao_local ? [legs[0].conexao_local] : [])
  if (stops.length === 0) return null
  return `${stops.length} conexão${stops.length > 1 ? 'ões' : ''} (${stops.join(', ')})`
}

/** Duração total do trecho (partida do 1º voo → chegada do último) —
 *  mostrada na linha origem→destino do bloco de voo. */
function totalDuration(first: FlightLegInfo, last: FlightLegInfo): string | null {
  if (!first.data || !first.horario) return null
  const arrDate = last.data_chegada || last.data
  const arrTime = last.horario_chegada || last.horario
  if (!arrDate || !arrTime) return null
  const dep = new Date(`${first.data}T${first.horario}`).getTime()
  const arr = new Date(`${arrDate}T${arrTime}`).getTime()
  if (isNaN(dep) || isNaN(arr) || arr <= dep) return null
  const mins = Math.round((arr - dep) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? `${m}m` : ''}`
}

/** Bloco de voo (ida ou volta) — 4 linhas fixas, cada uma em grid de
 *  colunas (não flex de largura variável) pra manter tudo alinhado mesmo
 *  quando o conteúdo muda de tamanho entre um voo e outro:
 *  1. Cia + número | localizador (web check-in, etiqueta) | status (etiqueta)
 *  2. Data de embarque  —  data de chegada
 *  3. Origem (destaque) + horário (menor/apagado)  →  destino (destaque) + horário (menor/apagado) + duração
 *  4. Conexão, em etiqueta — só quando houver */
export function FlightBlock({ legs, locator }: { legs: FlightLegInfo[]; locator: string | null }) {
  if (legs.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  const first = legs[0]
  const last = legs[legs.length - 1]
  const numero = Array.from(new Set(legs.map(l => l.numero_voo).filter(Boolean))).join(' + ') || '—'
  const worst = (['cancelled', 'diverted', 'active', 'scheduled', 'unknown', 'landed'] as const)
    .find(s => legs.some(l => l.status === s)) || 'scheduled'
  const meta = FLIGHT_STATUS_META[worst]
  const delay = legs.reduce((sum, l) => sum + (l.delay_minutes || 0), 0)
  const conn = connectionLabel(legs)
  const duration = totalDuration(first, last)
  const arrivalDate = last.data_chegada || last.data
  const nextDayArrival = arrivalDate && first.data && arrivalDate !== first.data
  // Localizador do voo em si ("web check-in", campo do produto aéreo em
  // Reservas › Produtos) — prioridade sobre o localizador de pacote/aéreo da
  // venda (prop `locator`, igual pros dois voos), que fica só de fallback.
  const webCheckin = Array.from(new Set(legs.map(l => l.localizador).filter(Boolean))).join(' + ') || null
  const badgeLocator = webCheckin || locator

  function copy() {
    if (!badgeLocator) return
    navigator.clipboard.writeText(badgeLocator).then(() => toast.success('Localizador copiado.'))
  }

  return (
    <div className="min-w-[210px] w-fit mx-auto rounded-lg border bg-muted/10 px-2.5 py-2 space-y-1 text-xs">
      {/* Linha 1 — cia + número | localizador (web check-in) | status */}
      <div className="flex flex-wrap items-center gap-1.5">
        <AirlineMark name={first.companhia} />
        <span className="font-semibold">{first.companhia || 'Cia não informada'}</span>
        <span className="text-muted-foreground">{numero}</span>
        {badgeLocator && <span className="text-muted-foreground/40">|</span>}
        {badgeLocator && (
          <button
            type="button"
            onClick={copy}
            title="Copiar localizador (web check-in)"
            className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono font-medium">{badgeLocator}</Badge>
            <ClipboardCopy className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
        <span className="text-muted-foreground/40">|</span>
        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', meta?.badge)}>
          {meta?.label}{delay > 0 ? ` +${Math.floor(delay / 60)}h${delay % 60 || ''}` : ''}
        </Badge>
      </div>

      {/* Linha 2 — data de embarque — data de chegada — colunas de largura fixa,
          coladas (sem esticar pra largura do card), pra ficar no mesmo lugar
          em toda linha da tabela. */}
      <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
        <span>{fmtShort(first.data)}</span>
        <span>—</span>
        <span>
          {fmtShort(arrivalDate)}
          {nextDayArrival && <sup className="text-primary font-semibold ml-0.5">+1</sup>}
        </span>
      </div>

      {/* Linha 3 — origem+horário → destino+horário (duração) — mesma lógica
          de colunas fixas e coladas, horário do lado do código do aeroporto. */}
      <div className="grid grid-cols-[30px_38px_14px_30px_38px_auto] items-baseline gap-x-1 tabular-nums whitespace-nowrap">
        <span className="font-bold text-foreground">{first.origem || '—'}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{first.horario || ''}</span>
        <span className="text-center text-muted-foreground">→</span>
        <span className="font-bold text-foreground">{last.destino || '—'}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{last.horario_chegada || ''}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{duration ? `(${duration})` : ''}</span>
      </div>

      {/* Linha 4 — conexão, em etiqueta, só quando houver */}
      {conn && (
        <div>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal text-muted-foreground">
            {conn}
          </Badge>
        </div>
      )}
    </div>
  )
}
