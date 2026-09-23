/**
 * Verificador do aéreo (issue #9 § 3.5) — usa o que a integração AeroDataBox
 * informou por último (sale_flight_status, gravado pelo cron
 * flight-status-cron.ts) pra decidir a cor do indicador ao lado da rota. Não
 * faz nenhuma chamada de API — só lê o que `listScheduledTrips` já trouxe.
 *
 * Importante: NÃO compara `leg.horario` (horário digitado na reserva, texto
 * livre no fuso do aeroporto de origem) com `scheduled_departure`/
 * `revised_departure` (timestamps em UTC — `fetchFlightStatus` em
 * actions/flight-lookup.ts só grava o `.utc` que a AeroDataBox devolve, sem
 * o fuso do aeroporto). Convertê-los pro fuso do navegador de quem está
 * vendo a tela e comparar como texto dava divergência falsa em qualquer voo
 * fora do fuso de Brasília — pior que não verificar (a própria issue #9 § 3.5
 * pede pra nunca inventar divergência). Só os campos que a API compara
 * consigo mesma (status e `delay_minutes`, ambos derivados de
 * revisedUtc-scheduledUtc) são seguros de usar aqui.
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

function fmtCheckedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

function lastCheckedLine(checkedLegs: FlightLegInfo[]): string[] {
  const lastCheckedAt = checkedLegs.map(l => l.last_checked_at).filter(Boolean).sort().pop() || null
  const label = fmtCheckedAt(lastCheckedAt)
  return label ? [`Última verificação: ${label}`] : []
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
