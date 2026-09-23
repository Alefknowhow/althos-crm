/**
 * Verificador do aéreo (issue #9 § 3.5) — compara o horário registrado na
 * reserva (Reservas › Produtos) com o que a integração AeroDataBox informou
 * por último (sale_flight_status, gravado pelo cron flight-status-cron.ts)
 * pra decidir a cor do indicador ao lado da rota. Não faz nenhuma chamada de
 * API — só lê o que `listScheduledTrips` já trouxe.
 *
 * Ida e volta são verificadas independentemente: cada bloco de FlightBlock
 * chama isso só com os trechos daquele sentido.
 */

import type { FlightLegInfo } from '@/actions/travel-schedule'

export type FlightVerifyState = 'green' | 'red' | 'neutral'

export type FlightVerifyResult = {
  state: FlightVerifyState
  /** Texto curto pro título/aria-label do indicador. */
  summary: string
  /** Linhas do tooltip (situação, última verificação, divergência quando houver). */
  lines: string[]
}

function fmtTime(hhmm?: string | null): string | null {
  if (!hhmm) return null
  const m = /^(\d{2}):(\d{2})/.exec(hhmm)
  return m ? `${m[1]}:${m[2]}` : hhmm
}

function fmtCheckedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

/** Horário informado pela API pro voo (o campo pode vir como timestamp ISO
 *  ou já como HH:mm, dependendo do que fetchFlightStatus normalizou). */
function apiTime(revised: string | null): string | null {
  if (!revised) return null
  if (/^\d{2}:\d{2}/.test(revised)) return fmtTime(revised)
  const d = new Date(revised)
  if (isNaN(d.getTime())) return null
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Verifica um sentido (ida OU volta) — todos os trechos daquele sentido. */
function lastCheckedLine(checkedLegs: FlightLegInfo[]): string[] {
  const lastCheckedAt = checkedLegs.map(l => l.last_checked_at).filter(Boolean).sort().pop() || null
  const label = fmtCheckedAt(lastCheckedAt)
  return label ? [`Última verificação: ${label}`] : []
}

/** Trecho com horário registrado divergindo do informado pela API, se houver. */
function findTimeDivergence(checkedLegs: FlightLegInfo[]): { registered: string; informed: string } | null {
  for (const leg of checkedLegs) {
    const registered = fmtTime(leg.horario)
    const informed = apiTime(leg.revised_departure)
    if (registered && informed && registered !== informed) return { registered, informed }
  }
  return null
}

export function verifyFlight(legs: FlightLegInfo[]): FlightVerifyResult | null {
  if (legs.length === 0) return null

  const checkedLegs = legs.filter(l => l.status !== null)
  if (checkedLegs.length === 0) {
    return { state: 'neutral', summary: 'Ainda não verificado', lines: ['Ainda não verificado com a companhia aérea.'] }
  }
  const checkedLines = lastCheckedLine(checkedLegs)

  if (checkedLegs.some(l => l.status === 'cancelled')) {
    return { state: 'red', summary: 'Voo cancelado', lines: ['Voo cancelado', ...checkedLines] }
  }
  if (checkedLegs.some(l => l.status === 'diverted')) {
    return { state: 'red', summary: 'Voo desviado', lines: ['Voo desviado', ...checkedLines] }
  }

  const divergence = findTimeDivergence(checkedLegs)
  if (divergence) {
    return {
      state: 'red',
      summary: 'Alteração identificada',
      lines: [
        'Alteração identificada',
        `Saída registrada: ${divergence.registered}`,
        `Saída informada: ${divergence.informed}`,
        ...checkedLines,
      ],
    }
  }

  const delay = Math.max(0, ...checkedLegs.map(l => l.delay_minutes || 0))
  if (delay > 0) {
    return {
      state: 'red',
      summary: 'Atraso identificado',
      lines: [`Atraso identificado — +${Math.floor(delay / 60)}h${delay % 60 ? `${delay % 60}m` : ''}`, ...checkedLines],
    }
  }

  return { state: 'green', summary: 'Conforme o registrado', lines: ['Voo conforme o registrado', ...checkedLines] }
}
