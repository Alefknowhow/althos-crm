/**
 * Read-only analytics tools for the AI Analyst (dashboard chat) --
 * executor dispatcher. Tool schemas, types and niche filtering live in
 * insights-tools-definitions.ts; each tool's implementation lives in one of
 * the insights-tools-{metrics,contacts,travel-summary,travel-detail,ops,
 * clinic,realestate}.ts modules. This file wires `name` -> implementation
 * and re-exports what the rest of the app imports from here.
 *
 * Adding a new tool: push its schema to ANALYTICS_TOOLS (in
 * insights-tools-definitions.ts), write the implementation in the matching
 * vertical module, and add a case below. Resist the urge to make one
 * mega-tool -- Claude routes better with explicit, single-purpose tools.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { queryKpis, querySales, queryPipeline, queryForecast, queryAppointments, queryMarketing } from './insights-tools-metrics'
import { queryContacts, queryAppointmentsDetailed, queryTopLeads } from './insights-tools-contacts'
import { queryQuotes, queryReservations, queryDepartures, queryOffers } from './insights-tools-travel-summary'
import { queryFullReservation, queryClientTravelHistory, queryFullQuotation, queryBlocks } from './insights-tools-travel-detail'
import { queryInactiveCustomers, queryTasks } from './insights-tools-ops'
import { queryClinicAttendances, queryClinicCommissions, queryProcedures, queryTreatments, queryStock } from './insights-tools-clinic'
import { queryProperties, queryVisits, queryDeals } from './insights-tools-realestate'

export type { AnalyticsContext, AnalyticsView, AnalyticsResult, CopilotNiche } from './insights-tools-definitions'
export { ANALYTICS_TOOLS, copilotNicheFor, getAnalyticsToolsForNiche } from './insights-tools-definitions'

/* ------- Executor dispatcher ------- */

export async function executeAnalyticsTool(
  name: string,
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  try {
    switch (name) {
      case 'consultar_kpis':
        return await queryKpis(input, ctx)
      case 'consultar_vendas':
        return await querySales(input, ctx)
      case 'consultar_pipeline':
        return await queryPipeline(input, ctx)
      case 'consultar_forecast':
        return await queryForecast(input, ctx)
      case 'consultar_agendamentos':
        return await queryAppointments(input, ctx)
      case 'consultar_marketing':
        return await queryMarketing(input, ctx)
      case 'consultar_contatos':
        return await queryContacts(input, ctx)
      case 'consultar_agendamentos_detalhado':
        return await queryAppointmentsDetailed(input, ctx)
      case 'consultar_top_leads':
        return await queryTopLeads(input, ctx)
      case 'consultar_cotacoes':
        return await queryQuotes(input, ctx)
      case 'consultar_reservas':
        return await queryReservations(input, ctx)
      case 'consultar_embarques':
        return await queryDepartures(input, ctx)
      case 'consultar_reserva_completa':
        return await queryFullReservation(input, ctx)
      case 'consultar_viagens_cliente':
        return await queryClientTravelHistory(input, ctx)
      case 'consultar_cotacao_completa':
        return await queryFullQuotation(input, ctx)
      case 'consultar_bloqueios':
        return await queryBlocks(input, ctx)
      case 'consultar_clientes_inativos':
        return await queryInactiveCustomers(input, ctx)
      case 'consultar_ofertas':
        return await queryOffers(input, ctx)
      case 'consultar_tarefas':
        return await queryTasks(input, ctx)
      case 'consultar_atendimentos_clinicos':
        return await queryClinicAttendances(input, ctx)
      case 'consultar_comissoes_clinicas':
        return await queryClinicCommissions(input, ctx)
      case 'consultar_procedimentos':
        return await queryProcedures(input, ctx)
      case 'consultar_tratamentos':
        return await queryTreatments(input, ctx)
      case 'consultar_estoque':
        return await queryStock(input, ctx)
      case 'consultar_imoveis':
        return await queryProperties(input, ctx)
      case 'consultar_visitas':
        return await queryVisits(input, ctx)
      case 'consultar_negociacoes':
        return await queryDeals(input, ctx)
      default:
        return {
          summary: `Tool desconhecida: ${name}`,
          view: { type: 'none' },
        }
    }
  } catch (e: any) {
    return {
      summary: `Erro ao executar ${name}: ${e?.message || 'falha inesperada'}`,
      view: { type: 'none' },
    }
  }
}
