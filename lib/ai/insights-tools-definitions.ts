/**
 * Types, tool schemas (ANALYTICS_TOOLS) and niche filtering for the AI
 * Analyst (dashboard chat). Split out of insights-tools.ts, which keeps only
 * the executeAnalyticsTool dispatcher and re-exports.
 *
 * Each tool returns BOTH a plaintext summary (Claude reads it to reason about
 * the answer) AND a structured `view` payload (the UI parses it to render a
 * chart/table card). The tool's textual result sent back to the model is the
 * JSON-stringified shape — Claude can read either.
 *
 * Tools are intentionally narrow: each one answers a specific class of
 * question. Adding new tools is straightforward (push to ANALYTICS_TOOLS +
 * add a case in insights-tools.ts). Resist the urge to make one mega-tool —
 * Claude routes better with explicit, single-purpose tools.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTravelNiche, isClinicNiche, isRealEstateNiche } from '@/lib/niche'
import { ANALYTICS_TOOLS } from './insights-tools-schemas'

export { ANALYTICS_TOOLS } from './insights-tools-schemas'

export type AnalyticsContext = {
  orgId: string
  orgSlug: string
  supabase: SupabaseClient
}

/* ------- View payload (shape consumed by the UI) ------- */

export type AnalyticsView =
  | { type: 'kpis'; items: Array<{ label: string; value: string; delta?: number; deltaLabel?: string }> }
  | { type: 'time_series'; data: Array<Record<string, any>>; series: Array<{ key: string; label: string; color?: string }> }
  | { type: 'bar'; data: Array<{ name: string; value: number }>; color?: string }
  | { type: 'pie'; data: Array<{ name: string; value: number }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'none' }

export type AnalyticsResult = {
  summary: string
  view: AnalyticsView
}

/* ------- Filtragem por nicho — cada org só vê as tools relevantes pro seu
 * negócio, tanto na lista enviada ao modelo (menos ruído, roteamento mais
 * preciso) quanto no prompt (ver insights-prompt.ts). ------- */

const TRAVEL_TOOL_NAMES = new Set(['consultar_cotacoes', 'consultar_reservas', 'consultar_embarques', 'consultar_ofertas', 'consultar_bloqueios', 'consultar_reserva_completa', 'consultar_viagens_cliente', 'consultar_cotacao_completa'])
const CLINIC_TOOL_NAMES = new Set(['consultar_atendimentos_clinicos', 'consultar_comissoes_clinicas', 'consultar_procedimentos', 'consultar_tratamentos', 'consultar_estoque'])
const REAL_ESTATE_TOOL_NAMES = new Set(['consultar_imoveis', 'consultar_visitas', 'consultar_negociacoes'])
const ALL_NICHE_TOOL_NAMES = new Set(Array.from(TRAVEL_TOOL_NAMES).concat(Array.from(CLINIC_TOOL_NAMES), Array.from(REAL_ESTATE_TOOL_NAMES)))

export type CopilotNiche = 'travel' | 'clinic' | 'real_estate' | 'generic'

export function copilotNicheFor(niche: string | null | undefined): CopilotNiche {
  if (isTravelNiche(niche)) return 'travel'
  if (isClinicNiche(niche)) return 'clinic'
  if (isRealEstateNiche(niche)) return 'real_estate'
  return 'generic'
}

/** Resolve o CopilotNiche da org a partir do orgId — usado por tools que
 *  precisam ramificar por nicho mas só recebem AnalyticsContext (sem o
 *  niche já resolvido, ao contrário do prompt/lista de tools do route.ts). */
export async function resolveOrgNicheForTools(ctx: AnalyticsContext): Promise<CopilotNiche> {
  const { data } = await ctx.supabase.from('organizations').select('niche').eq('id', ctx.orgId).maybeSingle()
  return copilotNicheFor((data as any)?.niche)
}

/** Tools genéricas (todo nicho) + só o conjunto específico do nicho da org. */
export function getAnalyticsToolsForNiche(niche: CopilotNiche): Anthropic.Messages.Tool[] {
  const nicheSet = niche === 'travel' ? TRAVEL_TOOL_NAMES : niche === 'clinic' ? CLINIC_TOOL_NAMES : niche === 'real_estate' ? REAL_ESTATE_TOOL_NAMES : null
  return ANALYTICS_TOOLS.filter(t => !ALL_NICHE_TOOL_NAMES.has(t.name) || (nicheSet && nicheSet.has(t.name)))
}
