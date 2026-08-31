/**
 * Read-only analytics tools for the AI Analyst (dashboard chat).
 *
 * Each tool returns BOTH a plaintext summary (Claude reads it to reason about
 * the answer) AND a structured `view` payload (the UI parses it to render a
 * chart/table card). The tool's textual result sent back to the model is the
 * JSON-stringified shape — Claude can read either.
 *
 * Tools are intentionally narrow: each one answers a specific class of
 * question. Adding new tools is straightforward (push to ANALYTICS_TOOLS +
 * add a case here). Resist the urge to make one mega-tool — Claude routes
 * better with explicit, single-purpose tools.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import { isTravelNiche, isClinicNiche, isRealEstateNiche } from '@/lib/niche'

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

/* ------- Tool definitions ------- */

const PERIOD_PARAM = {
  type: 'string',
  description:
    'Período de análise. Aceita: "7d", "30d", "90d", "mtd" (mês até hoje), "qtd" (trimestre até hoje), "ytd" (ano até hoje). Padrão: "30d".',
  enum: ['7d', '30d', '90d', 'mtd', 'qtd', 'ytd'],
}

export const ANALYTICS_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'consultar_kpis',
    description:
      'Retorna os KPIs principais do negócio no período: novos leads, vendas, faturamento, taxa de conversão, ticket médio — com comparativo automático com o período anterior. Use SEMPRE que o usuário pedir um resumo, panorama, "como está o negócio", "visão geral" ou métricas agregadas.',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_vendas',
    description:
      'Consulta vendas no período, opcionalmente agrupadas. Use quando o usuário pedir "vendas", "faturamento", "evolução de vendas", "vendas por mês", "vendas por produto", "vendas por vendedor", "quanto vendi".',
    input_schema: {
      type: 'object',
      properties: {
        periodo: PERIOD_PARAM,
        agrupar_por: {
          type: 'string',
          enum: ['dia', 'mes', 'produto', 'vendedor'],
          description:
            'Como agrupar as vendas. "dia"/"mes" geram série temporal (gráfico de linha). "produto"/"vendedor" geram ranking (gráfico de barras). Padrão: "mes" para períodos longos, "dia" para curtos.',
        },
      },
    },
  },
  {
    name: 'consultar_pipeline',
    description:
      'Funil de conversão: quantos leads estão em cada estágio, valor agregado e a TAXA DE CONVERSÃO entre estágios (quanto % passa de um pro próximo, e do primeiro ao último). Use para "como está o funil", "onde estou perdendo mais leads", "taxa de conversão", "pipeline".',
    input_schema: {
      type: 'object',
      properties: {
        periodo: PERIOD_PARAM,
        pipeline_id: {
          type: 'string',
          description: 'ID opcional de pipeline específico. Se omitido, usa o padrão da org.',
        },
      },
    },
  },
  {
    name: 'consultar_forecast',
    description:
      'Projeção de receita: quanto já foi fechado no mês + quanto é esperado do pipeline atual (ponderado pela probabilidade histórica de cada estágio fechar). Use para "forecast", "previsão de receita", "quanto vou faturar", "projeção do mês/trimestre".',
    input_schema: {
      type: 'object',
      properties: {
        pipeline_id: {
          type: 'string',
          description: 'ID opcional de pipeline específico. Se omitido, considera o(s) pipeline(s) padrão da org.',
        },
      },
    },
  },
  {
    name: 'consultar_agendamentos',
    description:
      'Resumo de agendamentos no período (status + próximos da semana). Use para "agendamentos", "agenda", "compromissos", "consultas marcadas", "quantas consultas".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_marketing',
    description:
      'Performance de campanhas no período: investimento, CPL, leads, ROI. Use para "campanhas", "tráfego", "anúncios", "marketing", "quanto gastei", "qual campanha vai melhor".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_contatos',
    description:
      'Busca detalhada de contatos/clientes com filtros e retorna a LISTA COMPLETA (nome, telefone, e-mail, cidade, endereço, status, valor) — não um resumo agregado. Use para qualquer pedido de listagem específica: "quais clientes moram em [cidade]", "lista de clientes de [cidade/estado]", "clientes com tag X", "clientes acima de R$ X", "me dá o telefone/e-mail de...". Sempre que o usuário pedir uma LISTA (não uma contagem), use esta tool em vez de consultar_top_leads ou consultar_kpis.',
    input_schema: {
      type: 'object',
      properties: {
        cidade: { type: 'string', description: 'Filtra por cidade (contatos.city). Aceita nome parcial.' },
        estado: { type: 'string', description: 'Filtra por estado (UF).' },
        status: { type: 'string', enum: ['lead', 'cliente', 'inativo'], description: 'Filtra por status do contato. Omitido = todos.' },
        tag: { type: 'string', description: 'Filtra contatos que tenham essa tag.' },
        valor_minimo: { type: 'number', description: 'Valor mínimo (R$) do contato (value_cents). Opcional.' },
        busca: { type: 'string', description: 'Busca livre por nome, e-mail ou telefone. Opcional.' },
        limite: { type: 'integer', description: 'Máximo de contatos a retornar (1 a 100). Padrão: 30.' },
      },
    },
  },
  {
    name: 'consultar_agendamentos_detalhado',
    description:
      'Lista agendamentos individuais (não um resumo por status) — cliente, serviço/procedimento, profissional (quando aplicável), data/hora e status. Use quando o usuário pedir a AGENDA em si: "quais são os agendamentos de amanhã/desta semana", "agenda de [profissional]", "quem tem consulta/reunião marcada", "próximos agendamentos". Para contagens agregadas, use consultar_agendamentos.',
    input_schema: {
      type: 'object',
      properties: {
        direcao: { type: 'string', enum: ['futuros', 'passados'], description: 'Futuros (a partir de agora) ou passados. Padrão: futuros.' },
        dias: { type: 'integer', description: 'Janela de dias a considerar (1 a 90). Padrão: 14.' },
        status: { type: 'string', description: 'Filtra por status do agendamento (ex.: scheduled, completed, canceled). Opcional.' },
        limite: { type: 'integer', description: 'Máximo de agendamentos a retornar (1 a 100). Padrão: 30.' },
      },
    },
  },
  {
    name: 'consultar_top_leads',
    description:
      'Lista os N leads mais quentes/recentes/valiosos da org. Use para "melhores leads", "leads mais quentes", "top clientes", "quem vale mais", "mostre os leads recentes".',
    input_schema: {
      type: 'object',
      properties: {
        criterio: {
          type: 'string',
          enum: ['score', 'valor', 'recente', 'sem_contato'],
          description:
            '"score" = maior ai_score. "valor" = maior value_cents. "recente" = mais recentes. "sem_contato" = mais tempo sem atividade.',
        },
        n: {
          type: 'integer',
          description: 'Quantos leads listar (1 a 20). Padrão: 10.',
        },
      },
      required: ['criterio'],
    },
  },
  {
    name: 'consultar_cotacoes',
    description:
      'Resumo das cotações/propostas de viagem no período: quantidade, valor total, distribuição por status (rascunho, enviada, aprovada etc.) e taxa de aprovação. Use para "cotações", "propostas", "orçamentos enviados", "quantas propostas", "taxa de aprovação de propostas".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_reservas',
    description:
      'Resumo das reservas/vendas de viagem fechadas no período: quantidade, faturamento, comissão total e ticket médio, com distribuição por status. Use para "reservas", "vendas de viagem", "viagens vendidas", "faturamento de viagens", "comissão".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_embarques',
    description:
      'Lista os próximos embarques (viagens com data de partida futura) nos próximos N dias. Use para "embarques", "próximas viagens", "quem viaja em breve", "partidas da semana", "agenda de viagens".',
    input_schema: {
      type: 'object',
      properties: {
        dias: {
          type: 'integer',
          description: 'Janela de dias à frente para listar embarques (1 a 180). Padrão: 30.',
        },
      },
    },
  },
  {
    name: 'consultar_reserva_completa',
    description:
      'Vertical Viagens: dá um mergulho completo numa reserva específica — dados da venda (destino, datas, valor, operadora, localizadores), TODOS os produtos cadastrados na aba Produtos (voos, hospedagens, transfers, passeios, cruzeiros — com companhia/localizador/datas de cada um), vouchers com o link direto pra abrir, tarefas vinculadas, lista de viajantes com idade calculada, e os parentes cadastrados do cliente principal. Use SEMPRE que a pergunta for sobre UMA reserva/cliente específico: "qual voo/hotel/operadora está na reserva de X", "qual o voucher da reserva X", "quem viaja com X", "quantos anos tem [viajante]", "quais os parentes de X", ou quando o usuário citar um nome de cliente pedindo detalhes da viagem dele.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Nome do cliente, número da reserva ou localizador (voo/hotel/pacote). Aceita nome parcial.' },
        data: { type: 'string', description: 'Data aproximada da viagem (YYYY-MM-DD), útil quando não souber o nome exato ou houver homônimos.' },
      },
      required: ['busca'],
    },
  },
  {
    name: 'consultar_viagens_cliente',
    description:
      'Vertical Viagens: lista TODO o histórico de viagens/reservas de um cliente específico (todas as vendas vinculadas a ele, não só a mais recente). Use para "todas as viagens do cliente X", "histórico de viagens de X", "quantas vezes X já viajou com a gente".',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome do cliente (aceita nome parcial).' },
      },
      required: ['cliente'],
    },
  },
  {
    name: 'consultar_bloqueios',
    description:
      'Resumo dos bloqueios de assentos/vagas de viagem: quantidade, ocupação (vendidos vs. disponíveis) e prazos próximos de vencer. Use para "bloqueios", "vagas bloqueadas", "quanto ainda tenho de bloqueio", "ocupação dos bloqueios".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_clientes_inativos',
    description:
      'Lista clientes sem nova venda/atendimento há N dias, com o detalhe da ÚLTIMA transação (valor + data, e destino/serviço/imóvel quando aplicável) — mesma base de Dashboard > Clientes, adaptada ao nicho da org (Viagens: reservas; Clínicas: atendimentos; Imobiliárias: negociações fechadas; demais: vendas). Use SEMPRE que a pergunta combinar "dias sem comprar/atender"/"clientes inativos"/"não volta há quanto tempo" com um filtro de valor (ex.: "e que gastaram mais de R$500").',
    input_schema: {
      type: 'object',
      properties: {
        dias_sem_comprar: { type: 'integer', description: 'Mínimo de dias desde a última venda/atendimento. Padrão: 30.' },
        valor_minimo_ultima_compra: { type: 'number', description: 'Valor mínimo (em R$) da ÚLTIMA transação do cliente, pra filtrar só quem tinha ticket relevante. Opcional.' },
      },
    },
  },
  {
    name: 'consultar_ofertas',
    description:
      'Resumo das ofertas/pacotes da vitrine de viagens: total cadastrado, publicados vs. rascunho e distribuição por categoria. Use para "ofertas", "pacotes", "vitrine", "quantos pacotes publicados".',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'consultar_tarefas',
    description:
      'Panorama operacional das tarefas: quantas em aberto, em andamento, concluídas e vencidas (atrasadas). Use para "tarefas", "pendências", "o que está atrasado", "tarefas vencidas", "produtividade da equipe".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_atendimentos_clinicos',
    description:
      'Vertical Clínicas: atendimentos no período, taxa de no-show e atendimentos por profissional. Use para "atendimentos", "quantos pacientes atendemos", "taxa de falta", "no-show", "produtividade por profissional". SÓ retorna dado operacional/comercial (contagens, status, nomes) — nunca conteúdo clínico das observações.',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_comissoes_clinicas',
    description:
      'Vertical Clínicas: comissões calculadas no período (pendentes vs. pagas), por profissional. Use para "comissões", "quanto devo aos profissionais", "comissão pendente", "comissão paga".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_procedimentos',
    description:
      'Vertical Clínicas: catálogo de procedimentos cadastrados (Agendamentos > Procedimentos) — quantos ativos, preço médio, distribuição por status. Use para "procedimentos", "catálogo de serviços", "quais procedimentos oferecemos", "preço dos procedimentos". NUNCA acessa prontuário/dado clínico — só o cadastro comercial do serviço.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_tratamentos',
    description:
      'Vertical Clínicas: pacotes/tratamentos de sessões vendidos (Tratamentos) — quantos ativos, sessões usadas vs. contratadas, valor total, próximos a vencer. Use para "tratamentos", "pacotes de sessão", "quantos pacotes em andamento", "pacotes vencendo".',
    input_schema: { type: 'object', properties: { periodo: PERIOD_PARAM } },
  },
  {
    name: 'consultar_estoque',
    description:
      'Vertical Clínicas: estoque de insumos — valor total em estoque, itens com estoque baixo, itens mais consumidos no período. Use para "estoque", "insumos", "quanto tenho em estoque", "o que está acabando", "itens mais consumidos".',
    input_schema: { type: 'object', properties: { periodo: PERIOD_PARAM } },
  },
  {
    name: 'consultar_imoveis',
    description:
      'Vertical Imobiliárias: portfólio de imóveis — quantos disponíveis/reservados/vendidos/alugados, valor médio, distribuição por tipo/finalidade. Use para "imóveis", "portfólio", "quantos imóveis disponíveis", "estoque de imóveis".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_visitas',
    description:
      'Vertical Imobiliárias: visitas agendadas no período — quantidade, status (realizada/cancelada/agendada), corretor com mais visitas. Use para "visitas", "quantas visitas", "agenda de visitas", "visitas por corretor".',
    input_schema: { type: 'object', properties: { periodo: PERIOD_PARAM } },
  },
  {
    name: 'consultar_negociacoes',
    description:
      'Vertical Imobiliárias: propostas e negociações fechadas (vendas/locações) no período — quantidade, valor total, comissão, taxa de fechamento. Use para "negociações", "propostas", "negócios fechados", "vendas de imóveis", "comissão de corretores".',
    input_schema: { type: 'object', properties: { periodo: PERIOD_PARAM } },
  },
]

/* ------- Filtragem por nicho — cada org só vê as tools relevantes pro seu
 * negócio, tanto na lista enviada ao modelo (menos ruído, roteamento mais
 * preciso) quanto no prompt (ver insights-prompt.ts). ------- */

const TRAVEL_TOOL_NAMES = new Set(['consultar_cotacoes', 'consultar_reservas', 'consultar_embarques', 'consultar_ofertas', 'consultar_bloqueios', 'consultar_reserva_completa', 'consultar_viagens_cliente'])
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
async function resolveOrgNicheForTools(ctx: AnalyticsContext): Promise<CopilotNiche> {
  const { data } = await ctx.supabase.from('organizations').select('niche').eq('id', ctx.orgId).maybeSingle()
  return copilotNicheFor((data as any)?.niche)
}

/** Tools genéricas (todo nicho) + só o conjunto específico do nicho da org. */
export function getAnalyticsToolsForNiche(niche: CopilotNiche): Anthropic.Messages.Tool[] {
  const nicheSet = niche === 'travel' ? TRAVEL_TOOL_NAMES : niche === 'clinic' ? CLINIC_TOOL_NAMES : niche === 'real_estate' ? REAL_ESTATE_TOOL_NAMES : null
  return ANALYTICS_TOOLS.filter(t => !ALL_NICHE_TOOL_NAMES.has(t.name) || (nicheSet && nicheSet.has(t.name)))
}

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

/* ------- Helpers ------- */

type Period = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd'

function periodWindow(period: Period | string | undefined): {
  start: Date
  prevStart: Date
  prevEnd: Date
  label: string
} {
  const now = new Date()
  const start = new Date()
  const prevStart = new Date()
  const prevEnd = new Date()
  switch ((period as Period) || '30d') {
    case '7d':
      start.setDate(now.getDate() - 7)
      prevStart.setDate(now.getDate() - 14)
      prevEnd.setDate(now.getDate() - 7)
      return { start, prevStart, prevEnd, label: 'últimos 7 dias' }
    case '90d':
      start.setDate(now.getDate() - 90)
      prevStart.setDate(now.getDate() - 180)
      prevEnd.setDate(now.getDate() - 90)
      return { start, prevStart, prevEnd, label: 'últimos 90 dias' }
    case 'mtd': {
      start.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime())
      // Same span in previous month for comparison.
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const daysIn = (now.getTime() - start.getTime()) / 86_400_000
      prevStart.setTime(prevMonthStart.getTime())
      prevEnd.setTime(prevMonthStart.getTime() + daysIn * 86_400_000)
      return { start, prevStart, prevEnd, label: 'mês atual' }
    }
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3)
      start.setTime(new Date(now.getFullYear(), q * 3, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear(), q * 3 - 3, 1).getTime())
      prevEnd.setTime(start.getTime())
      return { start, prevStart, prevEnd, label: 'trimestre atual' }
    }
    case 'ytd': {
      start.setTime(new Date(now.getFullYear(), 0, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear() - 1, 0, 1).getTime())
      prevEnd.setTime(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime())
      return { start, prevStart, prevEnd, label: 'ano atual' }
    }
    case '30d':
    default:
      start.setDate(now.getDate() - 30)
      prevStart.setDate(now.getDate() - 60)
      prevEnd.setDate(now.getDate() - 30)
      return { start, prevStart, prevEnd, label: 'últimos 30 dias' }
  }
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

function pctChange(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}

/* ------- Tool implementations ------- */

async function queryKpis(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, prevStart, prevEnd, label } = periodWindow(input.periodo)
  const supabase = ctx.supabase

  // New leads + appointments (current + previous period).
  const [
    { count: leadsCur },
    { count: leadsPrev },
    { count: apptCur },
    { count: apptPrev },
  ] = await Promise.all([
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', start.toISOString()),
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', prevEnd.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', start.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', prevStart.toISOString())
      .lt('start_time', prevEnd.toISOString()),
  ])

  // Niche-aware sales (travel orgs → travel_sales). Fetch since prevStart and
  // split into current/previous windows client-side.
  const salesRows = await fetchNormalizedSales(supabase as any, ctx.orgId, {
    since: prevStart,
    onlyCompleted: true,
  })
  const inWindow = (d: string, s: Date, e?: Date) => {
    const t = new Date(d).getTime()
    return t >= s.getTime() && (!e || t < e.getTime())
  }
  const salesCur = salesRows.filter(r => inWindow(r.date, start))
  const salesPrev = salesRows.filter(r => inWindow(r.date, prevStart, prevEnd))

  const revenueCur = salesCur.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const revenuePrev = salesPrev.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const salesCount = salesCur.length
  const ticketMedio = salesCount > 0 ? revenueCur / salesCount : 0
  const conversao = leadsCur && leadsCur > 0 ? (salesCount / leadsCur) * 100 : 0

  const items = [
    {
      label: 'Novos leads',
      value: String(leadsCur || 0),
      delta: pctChange(leadsCur || 0, leadsPrev || 0),
      deltaLabel: 'vs. período anterior',
    },
    {
      label: 'Vendas',
      value: String(salesCount),
      delta: pctChange(salesCount, (salesPrev || []).length),
    },
    {
      label: 'Faturamento',
      value: fmtCurrency(revenueCur),
      delta: pctChange(revenueCur, revenuePrev),
    },
    {
      label: 'Ticket médio',
      value: fmtCurrency(ticketMedio),
    },
    {
      label: 'Conversão',
      value: `${conversao.toFixed(1)}%`,
    },
    {
      label: 'Agendamentos',
      value: String(apptCur || 0),
      delta: pctChange(apptCur || 0, apptPrev || 0),
    },
  ]

  const summary = `KPIs do período (${label}): ${leadsCur || 0} novos leads (${pctChange(leadsCur || 0, leadsPrev || 0).toFixed(1)}% vs. anterior), ${salesCount} vendas totalizando ${fmtCurrency(revenueCur)}, ticket médio ${fmtCurrency(ticketMedio)}, conversão de ${conversao.toFixed(1)}%, ${apptCur || 0} agendamentos.`

  return { summary, view: { type: 'kpis', items } }
}

async function querySales(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const groupBy: string = input.agrupar_por || (((input.periodo as string) || '30d') === '7d' ? 'dia' : 'mes')

  // Niche-aware: travel orgs record sales in travel_sales (no product dimension).
  if (await isOrgTravelNiche(ctx.supabase as any, ctx.orgId)) {
    const rows = await fetchNormalizedSales(ctx.supabase as any, ctx.orgId, { since: start })
    if (rows.length === 0) {
      return { summary: `Sem vendas registradas no período (${label}).`, view: { type: 'none' } }
    }

    if (groupBy === 'dia' || groupBy === 'mes') {
      const bucketKey = (d: string) => (groupBy === 'dia' ? d.slice(0, 10) : d.slice(0, 7))
      const bucketed = new Map<string, number>()
      for (const r of rows) bucketed.set(bucketKey(r.date), (bucketed.get(bucketKey(r.date)) || 0) + (r.amount_cents || 0))
      const seriesData = Array.from(bucketed.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total }))
      const total = seriesData.reduce((a, p) => a + p.total, 0)
      return {
        summary: `${rows.length} vendas de viagem no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
        view: {
          type: 'time_series',
          data: seriesData,
          series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
        },
      }
    }

    if (groupBy === 'produto') {
      const total = rows.reduce((a, r) => a + (r.amount_cents || 0), 0)
      return {
        summary: `Vendas de viagem não são agrupadas por produto. Total no período (${label}): ${rows.length} vendas, ${fmtCurrency(total)}.`,
        view: { type: 'none' },
      }
    }

    // vendedor
    const bucketed = new Map<string, number>()
    for (const r of rows) {
      const k = r.seller_id || 'Sem vendedor'
      bucketed.set(k, (bucketed.get(k) || 0) + (r.amount_cents || 0))
    }
    const data = Array.from(bucketed.entries())
      .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    return {
      summary: `Top ${data.length} vendedores por faturamento de viagens no período (${label}).`,
      view: { type: 'bar', data, color: '#10b981' },
    }
  }

  const { data: sales } = await ctx.supabase
    .from('sales')
    .select('sale_date, amount_cents, product_id, seller_id, products(name)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'completed')
    .gte('sale_date', start.toISOString().slice(0, 10))
    .order('sale_date', { ascending: true })

  if (!sales || sales.length === 0) {
    return {
      summary: `Sem vendas registradas no período (${label}).`,
      view: { type: 'none' },
    }
  }

  // Time series (dia/mês)
  if (groupBy === 'dia' || groupBy === 'mes') {
    const bucketKey = (d: string) =>
      groupBy === 'dia' ? d : d.slice(0, 7) // YYYY-MM
    const bucketed = new Map<string, number>()
    for (const s of sales) {
      const key = bucketKey(s.sale_date)
      bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
    }
    const seriesData = Array.from(bucketed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))
    const total = seriesData.reduce((a, p) => a + p.total, 0)
    return {
      summary: `${sales.length} vendas no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
      view: {
        type: 'time_series',
        data: seriesData,
        series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
      },
    }
  }

  // Bar chart (produto/vendedor)
  const dimension = groupBy === 'produto' ? 'product' : 'seller'
  const bucketed = new Map<string, number>()
  for (const s of sales) {
    const key =
      dimension === 'product'
        ? ((Array.isArray(s.products) ? s.products[0]?.name : (s.products as any)?.name) ||
          'Sem produto')
        : s.seller_id || 'Sem vendedor'
    bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
  }
  const data = Array.from(bucketed.entries())
    .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  return {
    summary: `Top ${data.length} ${dimension === 'product' ? 'produtos' : 'vendedores'} por faturamento no período (${label}).`,
    view: { type: 'bar', data, color: '#10b981' },
  }
}

async function queryPipeline(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getAdvancedFunnel } = await import('@/actions/dashboard')
  const periodo = (input.periodo as string) || '30d'
  const result = await getAdvancedFunnel(ctx.orgId, {
    period: periodo as any,
    source: { kind: 'all' },
    pipelineId: input.pipeline_id || null,
  })

  if (result.stages.length === 0) {
    return { summary: 'Nenhum estágio de pipeline configurado.', view: { type: 'none' } }
  }

  return {
    summary: `${result.total_leads} leads no funil, conversão geral de ${result.overall_conversion_pct.toFixed(1)}% (do 1º ao último estágio), valor agregado ${fmtCurrency(result.total_value_cents)}. Por estágio: ${result.stages.map(s => `${s.name} — ${s.count} leads (${s.conversion_from_previous.toFixed(0)}% do estágio anterior)`).join('; ')}.`,
    view: {
      type: 'table',
      columns: ['Estágio', 'Leads', 'Valor', 'Conversão do anterior'],
      rows: result.stages.map(s => [s.name, String(s.count), fmtCurrency(s.value_cents), `${s.conversion_from_previous.toFixed(0)}%`]),
    },
  }
}

async function queryForecast(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getRevenueForecast } = await import('@/actions/dashboard')
  const forecast = await getRevenueForecast(ctx.orgId, { pipelineId: input.pipeline_id || null })

  if (forecast.stages.length === 0 && forecast.already_won_cents === 0) {
    return { summary: 'Sem dados suficientes no pipeline para projetar receita.', view: { type: 'none' } }
  }

  const items = [
    { label: 'Já ganho (mês)', value: fmtCurrency(forecast.already_won_cents) },
    { label: 'Esperado do pipeline', value: fmtCurrency(forecast.total_expected_cents) },
    { label: 'Projeção combinada', value: fmtCurrency(forecast.combined_forecast_cents) },
  ]

  const byStage = forecast.stages
    .map(s => `${s.stage_name} (${(s.probability * 100).toFixed(0)}% de ${s.lead_count} leads)`)
    .join(', ')

  return {
    summary: `Forecast do mês: já ganho ${fmtCurrency(forecast.already_won_cents)} + esperado do pipeline ${fmtCurrency(forecast.total_expected_cents)} = projeção combinada de ${fmtCurrency(forecast.combined_forecast_cents)}.${byStage ? ` Por estágio: ${byStage}.` : ''}`,
    view: { type: 'kpis', items },
  }
}

async function queryAppointments(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('appointments')
    .select('status')
    .eq('organization_id', ctx.orgId)
    .gte('start_time', start.toISOString())

  if (!data || data.length === 0) {
    return { summary: `Sem agendamentos no período (${label}).`, view: { type: 'none' } }
  }

  const counts = new Map<string, number>()
  for (const a of data) counts.set(a.status, (counts.get(a.status) || 0) + 1)

  const STATUS_LABEL: Record<string, string> = {
    scheduled: 'Agendados',
    completed: 'Concluídos',
    canceled: 'Cancelados',
  }

  const pieData = Array.from(counts.entries()).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k,
    value: v,
  }))

  const total = data.length
  const completed = counts.get('completed') || 0
  const canceled = counts.get('canceled') || 0
  const noShowRate = total > 0 ? (canceled / total) * 100 : 0

  return {
    summary: `${total} agendamentos no período (${label}): ${completed} concluídos, ${counts.get('scheduled') || 0} marcados, ${canceled} cancelados. Taxa de cancelamento: ${noShowRate.toFixed(1)}%.`,
    view: { type: 'pie', data: pieData },
  }
}

async function queryMarketing(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data: campaigns } = await ctx.supabase
    .from('campaigns')
    .select('id, name, utm_campaign')
    .eq('organization_id', ctx.orgId)

  if (!campaigns || campaigns.length === 0) {
    return { summary: 'Sem campanhas cadastradas.', view: { type: 'none' } }
  }

  const campaignIds = campaigns.map(c => c.id)
  const [{ data: metrics }, { data: subs }] = await Promise.all([
    ctx.supabase
      .from('campaign_metrics_daily')
      .select('campaign_id, spend_cents')
      .in('campaign_id', campaignIds)
      .eq('organization_id', ctx.orgId)
      .gte('date', start.toISOString().slice(0, 10)),
    ctx.supabase
      .from('form_submissions')
      .select('utm_campaign')
      .gte('created_at', start.toISOString())
      .not('utm_campaign', 'is', null),
  ])

  const spendByCampaign = new Map<string, number>()
  for (const m of metrics || [])
    spendByCampaign.set(m.campaign_id, (spendByCampaign.get(m.campaign_id) || 0) + (m.spend_cents || 0))

  const leadsByUtm = new Map<string, number>()
  for (const s of subs || []) {
    const k = String(s.utm_campaign || '').toLowerCase().trim()
    if (!k) continue
    leadsByUtm.set(k, (leadsByUtm.get(k) || 0) + 1)
  }

  const rows = campaigns
    .map(c => {
      const spend = spendByCampaign.get(c.id) || 0
      const leads = c.utm_campaign ? leadsByUtm.get(c.utm_campaign.toLowerCase().trim()) || 0 : 0
      const cpl = leads > 0 ? spend / leads : 0
      return {
        name: c.name,
        spend,
        leads,
        cpl,
      }
    })
    .filter(r => r.spend > 0 || r.leads > 0)
    .sort((a, b) => b.spend - a.spend)

  if (rows.length === 0) {
    return {
      summary: `Sem dados de marketing no período (${label}).`,
      view: { type: 'none' },
    }
  }

  const totalSpend = rows.reduce((a, r) => a + r.spend, 0)
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0)

  return {
    summary: `${rows.length} campanhas ativas no período (${label}). Total investido: ${fmtCurrency(totalSpend)}, ${totalLeads} leads atribuídos, CPL médio ${fmtCurrency(totalLeads > 0 ? totalSpend / totalLeads : 0)}.`,
    view: {
      type: 'table',
      columns: ['Campanha', 'Investimento', 'Leads', 'CPL'],
      rows: rows
        .slice(0, 15)
        .map(r => [r.name, fmtCurrency(r.spend), String(r.leads), r.cpl > 0 ? fmtCurrency(r.cpl) : '—']),
    },
  }
}

function formatAddress(r: { street?: string | null; number?: string | null; district?: string | null; city?: string | null; state?: string | null }): string {
  const line1 = [r.street, r.number].filter(Boolean).join(', ')
  const line2 = [r.district, r.city, r.state].filter(Boolean).join(' - ')
  return [line1, line2].filter(Boolean).join(' — ') || '—'
}

/**
 * Busca detalhada de contatos — a IA precisa conseguir ENTREGAR uma lista
 * completa (nome/telefone/e-mail/endereço), não só contagens/rankings
 * limitados como consultar_top_leads. Sem isso, pedidos do tipo "quais
 * clientes moram em Itajaí" batiam num beco sem saída (nenhuma tool cobria
 * filtro geográfico + retorno de lista completa).
 */
async function queryContacts(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const limite = Math.min(100, Math.max(1, Number(input.limite) || 30))

  let q = ctx.supabase
    .from('contatos')
    .select('name, phone, email, city, state, street, number, district, status, value_cents, tags')
    .eq('organization_id', ctx.orgId)
    .order('name')
    .limit(limite)

  if (input.cidade) q = q.ilike('city', `%${input.cidade}%`)
  if (input.estado) q = q.ilike('state', `%${input.estado}%`)
  if (input.status) q = q.eq('status', input.status)
  if (input.tag) q = q.contains('tags', [input.tag])
  if (input.valor_minimo) q = q.gte('value_cents', Math.round(Number(input.valor_minimo) * 100))
  if (input.busca) q = q.or(`name.ilike.%${input.busca}%,email.ilike.%${input.busca}%,phone.ilike.%${input.busca}%`)

  const { data, error } = await q
  if (error) return { summary: `Erro ao buscar contatos: ${error.message}`, view: { type: 'none' } }

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum contato encontrado com esses filtros.', view: { type: 'none' } }
  }

  return {
    summary: `${rows.length} contato(s) encontrado(s)${input.cidade ? ` em "${input.cidade}"` : ''}${input.status ? `, status ${input.status}` : ''}. Lista completa na tabela — nome, telefone, e-mail e endereço de cada um.`,
    view: {
      type: 'table',
      columns: ['Nome', 'Telefone', 'E-mail', 'Endereço', 'Status', 'Valor'],
      rows: rows.map(r => [
        r.name || '—',
        r.phone || '—',
        r.email || '—',
        formatAddress(r),
        r.status || '—',
        r.value_cents ? fmtCurrency(r.value_cents) : '—',
      ]),
    },
  }
}

/**
 * Lista agendamentos individuais (cliente, serviço, profissional quando
 * aplicável, data/hora, status) — consultar_agendamentos só dá contagem por
 * status, não serve pra "quais são os agendamentos de amanhã".
 */
async function queryAppointmentsDetailed(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const direction = input.direcao === 'passados' ? 'passados' : 'futuros'
  const dias = Math.min(90, Math.max(1, Number(input.dias) || 14))
  const limite = Math.min(100, Math.max(1, Number(input.limite) || 30))
  const now = new Date()
  const edge = new Date(now)
  edge.setDate(edge.getDate() + (direction === 'futuros' ? dias : -dias))

  let q = ctx.supabase
    .from('appointments')
    .select('start_time, status, guest_name, contato_id, contatos(name), event_types(name)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'canceled')

  if (direction === 'futuros') {
    q = q.gte('start_time', now.toISOString()).lte('start_time', edge.toISOString()).order('start_time', { ascending: true })
  } else {
    q = q.gte('start_time', edge.toISOString()).lte('start_time', now.toISOString()).order('start_time', { ascending: false })
  }
  if (input.status) q = q.eq('status', input.status)
  q = q.limit(limite)

  const { data, error } = await q
  if (error) return { summary: `Erro ao buscar agendamentos: ${error.message}`, view: { type: 'none' } }

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum agendamento ${direction} encontrado nos próximos/últimos ${dias} dias.`, view: { type: 'none' } }
  }

  return {
    summary: `${rows.length} agendamento(s) ${direction} encontrados (janela de ${dias} dias). O mais próximo: ${rows[0].contatos?.name || rows[0].guest_name || 'sem cliente'}, ${rows[0].event_types?.name || 'sem serviço definido'}, em ${new Date(rows[0].start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Serviço', 'Data/Hora', 'Status'],
      rows: rows.map(r => [
        r.contatos?.name || r.guest_name || '—',
        r.event_types?.name || '—',
        new Date(r.start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        r.status || '—',
      ]),
    },
  }
}

async function queryTopLeads(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const criterio = (input.criterio || 'recente') as string
  const n = Math.min(20, Math.max(1, Number(input.n) || 10))

  let q = ctx.supabase
    .from('contatos')
    .select('id, name, email, phone, value_cents, ai_score, ai_tier, source, updated_at, created_at')
    .eq('organization_id', ctx.orgId)
    .limit(n)

  switch (criterio) {
    case 'score':
      q = q.not('ai_score', 'is', null).order('ai_score', { ascending: false })
      break
    case 'valor':
      q = q.gt('value_cents', 0).order('value_cents', { ascending: false })
      break
    case 'sem_contato':
      q = q.order('updated_at', { ascending: true })
      break
    case 'recente':
    default:
      q = q.order('created_at', { ascending: false })
      break
  }

  const { data } = await q
  if (!data || data.length === 0) {
    return { summary: 'Nenhum lead encontrado.', view: { type: 'none' } }
  }

  return {
    summary: `Top ${data.length} leads por critério "${criterio}".`,
    view: {
      type: 'table',
      columns: ['Nome', 'Contato', 'Score', 'Valor', 'Origem'],
      rows: data.map(l => [
        l.name || '—',
        l.email || l.phone || '—',
        l.ai_score != null ? `${l.ai_score} (${l.ai_tier || ''})` : '—',
        l.value_cents ? fmtCurrency(l.value_cents) : '—',
        l.source || '—',
      ]),
    },
  }
}

/* ------- Travel-specific tools (cotações / reservas / embarques / ofertas) ------- */

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  rascunho: 'Rascunho',
  sent: 'Enviada',
  enviada: 'Enviada',
  approved: 'Aprovada',
  aprovada: 'Aprovada',
  rejected: 'Recusada',
  recusada: 'Recusada',
  expired: 'Expirada',
  expirada: 'Expirada',
}

function labelStatus(map: Record<string, string>, raw: string | null): string {
  if (!raw) return 'Sem status'
  return map[raw.toLowerCase()] || raw
}

async function queryQuotes(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_proposals')
    .select('client_name, status, total_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma cotação criada no período (${label}).`, view: { type: 'none' } }
  }

  const byStatus = new Map<string, number>()
  let totalCents = 0
  let approved = 0
  for (const r of rows) {
    const key = labelStatus(QUOTE_STATUS_LABEL, r.status)
    byStatus.set(key, (byStatus.get(key) || 0) + 1)
    totalCents += r.total_cents || 0
    if (['approved', 'aprovada'].includes((r.status || '').toLowerCase())) approved += 1
  }
  const approvalRate = rows.length > 0 ? (approved / rows.length) * 100 : 0

  const pieData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))

  // Lista de nomes vai só no texto (o view continua sendo o gráfico de
  // distribuição por status) — sem isso a IA nunca consegue responder "quem
  // pediu a cotação mais recente" ou listar clientes específicos.
  const recentList = rows.slice(0, 10).map(r => `${r.client_name || 'Sem nome'} (${labelStatus(QUOTE_STATUS_LABEL, r.status)}, ${fmtCurrency(r.total_cents || 0)}, ${new Date(r.created_at).toLocaleDateString('pt-BR')})`).join('; ')

  return {
    summary: `${rows.length} cotações no período (${label}), somando ${fmtCurrency(totalCents)}. ${approved} aprovadas (taxa de aprovação ${approvalRate.toFixed(1)}%). Distribuição por status: ${Array.from(byStatus.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}. Mais recentes: ${recentList}.`,
    view: { type: 'pie', data: pieData },
  }
}

async function queryReservations(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('contato_id, destination, status, total_cents, commission_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhuma reserva fechada no período (${label}).`, view: { type: 'none' } }
  }

  // Nome do cliente — sem isso a IA só consegue dar números agregados, nunca
  // responder "quem foi o último cliente" (motivo real de ter uma IA
  // integrada em vez de mandar o usuário olhar direto no CRM).
  const contatoIds = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean)))
  const { data: contatos } = contatoIds.length > 0
    ? await ctx.supabase.from('contatos').select('id, name').in('id', contatoIds)
    : { data: [] }
  const nameById = new Map<string, string>((contatos || []).map((c: any) => [c.id, c.name]))

  const revenue = rows.reduce((a, r) => a + (r.total_cents || 0), 0)
  const commission = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const ticket = rows.length > 0 ? revenue / rows.length : 0
  const mostRecent = rows[0]
  const mostRecentName = mostRecent.contato_id ? nameById.get(mostRecent.contato_id) || 'Cliente removido' : 'Sem cliente vinculado'

  const top = rows.slice(0, 30)

  return {
    summary: `${rows.length} reservas no período (${label}): faturamento ${fmtCurrency(revenue)}, comissão ${fmtCurrency(commission)}, ticket médio ${fmtCurrency(ticket)}. Reserva mais recente: ${mostRecentName}${mostRecent.destination ? ` (${mostRecent.destination})` : ''}, ${fmtCurrency(mostRecent.total_cents || 0)} em ${new Date(mostRecent.created_at).toLocaleDateString('pt-BR')}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Destino', 'Valor', 'Comissão', 'Data'],
      rows: top.map(r => [
        r.contato_id ? (nameById.get(r.contato_id) || 'Cliente removido') : 'Sem cliente vinculado',
        r.destination || '—',
        fmtCurrency(r.total_cents || 0),
        fmtCurrency(r.commission_cents || 0),
        new Date(r.created_at).toLocaleDateString('pt-BR'),
      ]),
    },
  }
}

async function queryDepartures(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const days = Math.min(180, Math.max(1, Number(input.dias) || 30))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const until = new Date(today)
  until.setDate(until.getDate() + days)

  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('client_name, destination, departure_date, return_date, total_cents, status')
    .eq('organization_id', ctx.orgId)
    .not('departure_date', 'is', null)
    .gte('departure_date', today.toISOString().slice(0, 10))
    .lte('departure_date', until.toISOString().slice(0, 10))
    .order('departure_date', { ascending: true })
    .limit(50)

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhum embarque previsto nos próximos ${days} dias.`, view: { type: 'none' } }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—'

  return {
    summary: `${rows.length} embarques previstos nos próximos ${days} dias. Próximo: ${rows[0].client_name || 'cliente'} para ${rows[0].destination || 'destino não informado'} em ${fmtDate(rows[0].departure_date)}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Destino', 'Partida', 'Retorno', 'Valor'],
      rows: rows.map(r => [
        r.client_name || '—',
        r.destination || '—',
        fmtDate(r.departure_date),
        fmtDate(r.return_date),
        r.total_cents ? fmtCurrency(r.total_cents) : '—',
      ]),
    },
  }
}

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

const PRODUCT_KIND_LABEL: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', transfer: 'Transfer', passeio: 'Passeio',
  cruzeiro: 'Cruzeiro', seguro: 'Seguro', ingresso: 'Ingresso', veiculo: 'Veículo', outro: 'Outro',
}

/** Resume o jsonb solto de um sale_product num texto legível — os campos
 *  variam por `kind` (ver actions/sale-products.ts), então tenta os campos
 *  mais comuns primeiro e cai pra um dump genérico se não reconhecer. */
function formatProductData(kind: string, data: Record<string, any>): string {
  const d = data || {}
  if (kind === 'aereo') {
    return [d.companhia, d.numero_voo && `voo ${d.numero_voo}`, d.origem && d.destino ? `${d.origem} → ${d.destino}` : null, d.data, d.horario, d.localizador && `localizador ${d.localizador}`].filter(Boolean).join(', ') || '—'
  }
  if (kind === 'hospedagem') {
    return [d.hotel, d.check_in && d.check_out ? `${d.check_in} a ${d.check_out}` : null, d.tipo_quarto, d.localizador && `localizador ${d.localizador}`].filter(Boolean).join(', ') || '—'
  }
  if (kind === 'transfer') {
    return [d.fornecedor, d.origem && d.destino ? `${d.origem} → ${d.destino}` : null, d.data, d.horario].filter(Boolean).join(', ') || '—'
  }
  if (kind === 'cruzeiro') {
    return [d.companhia, d.navio, d.roteiro, d.embarque_data].filter(Boolean).join(', ') || '—'
  }
  const generic = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
  return generic || '—'
}

/**
 * Mergulho completo numa reserva: dados da venda + produtos (aba Produtos) +
 * vouchers (com link direto) + tarefas vinculadas + viajantes (com idade) +
 * parentes do cliente principal — tudo que hoje só dava pra ver abrindo a
 * reserva manualmente no CRM, aba por aba.
 */
async function queryFullReservation(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const busca = String(input.busca || '').trim()
  if (!busca) return { summary: 'Informe o nome do cliente, número da reserva ou localizador pra buscar.', view: { type: 'none' } }

  let q = ctx.supabase
    .from('travel_sales')
    .select('id, sale_number, contato_id, client_name, destination, departure_date, return_date, total_cents, status, operator, package_locator, air_locator, hotel_locator, travelers, vouchers, notes')
    .eq('organization_id', ctx.orgId)
    .or(`client_name.ilike.%${busca}%,sale_number.ilike.%${busca}%,package_locator.ilike.%${busca}%,air_locator.ilike.%${busca}%,hotel_locator.ilike.%${busca}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (input.data) {
    q = ctx.supabase
      .from('travel_sales')
      .select('id, sale_number, contato_id, client_name, destination, departure_date, return_date, total_cents, status, operator, package_locator, air_locator, hotel_locator, travelers, vouchers, notes')
      .eq('organization_id', ctx.orgId)
      .or(`client_name.ilike.%${busca}%,sale_number.ilike.%${busca}%`)
      .eq('departure_date', input.data)
      .order('created_at', { ascending: false })
      .limit(5)
  }

  const { data: matches } = await q
  if (!matches || matches.length === 0) {
    return { summary: `Nenhuma reserva encontrada para "${busca}"${input.data ? ` na data ${input.data}` : ''}.`, view: { type: 'none' } }
  }

  const sale = matches[0] as any
  const otherMatches = matches.slice(1)

  const [{ data: products }, { data: tasks }, { data: contato }] = await Promise.all([
    ctx.supabase.from('sale_products').select('kind, status, data').eq('sale_id', sale.id).order('sort_order'),
    ctx.supabase.from('tasks').select('title, status, due_date').eq('sale_id', sale.id),
    sale.contato_id
      ? ctx.supabase.from('contatos').select('name, phone, email').eq('id', sale.contato_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const relationships = sale.contato_id
    ? (await ctx.supabase.from('contato_relationships').select('kind, note, related_contato_id, related_name, related_cpf, related_birth_date').eq('contato_id', sale.contato_id)).data
    : null

  const voucherLink = `/voucher-print/${ctx.orgSlug}/${sale.id}`
  const uploadedVouchers = (sale.vouchers as any[]) || []
  const travelers = (sale.travelers as any[]) || []

  const parts: string[] = []
  parts.push(`Reserva ${sale.sale_number || sale.id.slice(0, 8)} — ${sale.client_name || contato?.name || 'sem cliente'}, destino ${sale.destination || '—'}, ${sale.departure_date ? new Date(`${sale.departure_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'} a ${sale.return_date ? new Date(`${sale.return_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'}, valor ${fmtCurrency(sale.total_cents || 0)}, status ${sale.status}. Operadora: ${sale.operator || '—'}. Localizadores — pacote: ${sale.package_locator || '—'}, aéreo: ${sale.air_locator || '—'}, hotel: ${sale.hotel_locator || '—'}.`)

  if (products && products.length > 0) {
    parts.push(`Produtos cadastrados: ${products.map((p: any) => `${PRODUCT_KIND_LABEL[p.kind] || p.kind} (${formatProductData(p.kind, p.data)})`).join('; ')}.`)
  } else {
    parts.push('Nenhum produto cadastrado na aba Produtos dessa reserva.')
  }

  parts.push(`Voucher do sistema (documento oficial pra visualizar/imprimir): [Abrir voucher completo](${voucherLink})`)
  if (uploadedVouchers.length > 0) {
    // Link em formato [rótulo](url) — o chat renderiza como texto clicável
    // com o nome do arquivo, nunca a URL crua (mais legível, e evita link
    // gigante do Storage aparecendo por extenso na conversa).
    parts.push(`Arquivos de voucher anexados: ${uploadedVouchers.map((v, i) => `[${v.name || `voucher ${i + 1}`}](${v.url})`).join(', ')}.`)
  }

  if (travelers.length > 0) {
    parts.push(`Viajantes: ${travelers.map(t => `${t.name || 'sem nome'}${t.birth_date ? ` (${calcAge(t.birth_date)} anos)` : ''}`).join(', ')}.`)
  } else {
    parts.push('Nenhum viajante cadastrado além do cliente principal.')
  }

  if (relationships && relationships.length > 0) {
    parts.push(`Parentes cadastrados de ${sale.client_name || contato?.name}: ${relationships.map((r: any) => `${r.related_name || '—'} (${r.kind})`).join(', ')}.`)
  }

  if (tasks && tasks.length > 0) {
    parts.push(`Tarefas vinculadas: ${tasks.map((t: any) => `${t.title} [${t.status}]${t.due_date ? ` até ${new Date(t.due_date).toLocaleDateString('pt-BR')}` : ''}`).join('; ')}.`)
  }

  if (otherMatches.length > 0) {
    parts.push(`Encontrei outras ${otherMatches.length} reserva(s) parecida(s) pra "${busca}" — se não era essa, me diga o número da reserva ou a data pra eu buscar a certa.`)
  }

  return {
    summary: parts.join(' '),
    view: {
      type: 'table',
      columns: ['Tipo', 'Detalhe'],
      rows: (products || []).map((p: any) => [PRODUCT_KIND_LABEL[p.kind] || p.kind, formatProductData(p.kind, p.data)]),
    },
  }
}

/** Histórico completo de viagens de um cliente — todas as travel_sales
 *  vinculadas ao contato, não só a mais recente (isso é o que
 *  consultar_reservas/consultar_clientes_inativos não cobrem). */
async function queryClientTravelHistory(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const cliente = String(input.cliente || '').trim()
  if (!cliente) return { summary: 'Informe o nome do cliente.', view: { type: 'none' } }

  const { data: contatos } = await ctx.supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', ctx.orgId)
    .ilike('name', `%${cliente}%`)
    .limit(5)

  if (!contatos || contatos.length === 0) {
    return { summary: `Nenhum cliente encontrado com o nome "${cliente}".`, view: { type: 'none' } }
  }

  const contatoIds = contatos.map(c => c.id)
  const { data: sales } = await ctx.supabase
    .from('travel_sales')
    .select('sale_number, client_name, destination, departure_date, return_date, total_cents, status, contato_id')
    .eq('organization_id', ctx.orgId)
    .in('contato_id', contatoIds)
    .order('departure_date', { ascending: false })

  const rows = (sales as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma viagem/reserva encontrada pra "${cliente}".`, view: { type: 'none' } }
  }

  const totalValue = rows.reduce((a, r) => a + (r.total_cents || 0), 0)
  const name = contatos[0].name

  return {
    summary: `${rows.length} viagem(ns) encontrada(s) pra ${name}${contatos.length > 1 ? ` (e ${contatos.length - 1} outro(s) contato(s) com nome parecido)` : ''}, somando ${fmtCurrency(totalValue)}.`,
    view: {
      type: 'table',
      columns: ['Destino', 'Ida', 'Volta', 'Valor', 'Status'],
      rows: rows.map(r => [
        r.destination || '—',
        r.departure_date ? new Date(`${r.departure_date}T00:00:00`).toLocaleDateString('pt-BR') : '—',
        r.return_date ? new Date(`${r.return_date}T00:00:00`).toLocaleDateString('pt-BR') : '—',
        fmtCurrency(r.total_cents || 0),
        r.status || '—',
      ]),
    },
  }
}

async function queryBlocks(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('travel_blocks')
    .select('origem, destino, assentos_total, assentos_disponiveis, prazo')
    .eq('organization_id', ctx.orgId)
    .order('prazo', { ascending: true })

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum bloqueio cadastrado.', view: { type: 'none' } }
  }

  const totalSeats = rows.reduce((a, r) => a + (r.assentos_total || 0), 0)
  const availableSeats = rows.reduce((a, r) => a + (r.assentos_disponiveis || 0), 0)
  const soldSeats = totalSeats - availableSeats
  const today = new Date()
  const expiringSoon = rows.filter(r => r.prazo && new Date(r.prazo) >= today && (new Date(r.prazo).getTime() - today.getTime()) / 86_400_000 <= 15).length

  return {
    summary: `${rows.length} bloqueios ativos, ${soldSeats} de ${totalSeats} vagas vendidas (${availableSeats} disponíveis). ${expiringSoon} bloqueios com prazo vencendo em 15 dias.`,
    view: {
      type: 'table',
      columns: ['Origem', 'Destino', 'Total', 'Disponíveis'],
      rows: rows.map(r => [r.origem || '—', r.destino || '—', String(r.assentos_total || 0), String(r.assentos_disponiveis || 0)]),
    },
  }
}

type LastTransaction = { contato_id: string; amount_cents: number; date: string; extra: string | null }

/** Nicho Viagens: reservas fechadas (travel_sales). */
async function lastTransactionsTravel(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('contato_id, destination, total_cents, created_at, status')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelado')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.contato_id)
    if (!prev || r.created_at > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.total_cents || 0, date: r.created_at, extra: r.destination || null })
    }
  }
  return Array.from(byContato.values())
}

/** Nicho Clínicas: atendimentos (não é venda genérica — usa clinic_attendances). */
async function lastTransactionsClinic(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('clinic_attendances')
    .select('patient_contato_id, total_cents, discount_cents, attended_at, event_types(name)')
    .eq('organization_id', ctx.orgId)
    .not('patient_contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.patient_contato_id)
    if (!prev || r.attended_at > prev.date) {
      const net = Math.max(0, (r.total_cents || 0) - (r.discount_cents || 0))
      byContato.set(r.patient_contato_id, { contato_id: r.patient_contato_id, amount_cents: net, date: r.attended_at, extra: r.event_types?.name || null })
    }
  }
  return Array.from(byContato.values())
}

/** Nicho Imobiliárias: negociações fechadas (property_deals). */
async function lastTransactionsRealEstate(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('property_deals')
    .select('contato_id, final_price_cents, monthly_rent_cents, closed_at, status, properties(title)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelado')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const date = r.closed_at || ''
    if (!date) continue
    const prev = byContato.get(r.contato_id)
    if (!prev || date > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.final_price_cents || r.monthly_rent_cents || 0, date, extra: r.properties?.title || null })
    }
  }
  return Array.from(byContato.values())
}

/** Demais nichos: vendas genéricas (sales). */
async function lastTransactionsGeneric(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('sales')
    .select('contato_id, amount_cents, sale_date, status, products(name)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelled')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.contato_id)
    if (!prev || r.sale_date > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.amount_cents || 0, date: r.sale_date, extra: r.products?.name || null })
    }
  }
  return Array.from(byContato.values())
}

/**
 * Clientes sem nova venda/atendimento há N dias, com o detalhe da ÚLTIMA
 * transação — mesmo conceito de Dashboard > Clientes (RecompraTable), mas
 * generalizado pra qualquer nicho: cada um tem sua própria fonte de "venda"
 * (travel_sales, clinic_attendances, property_deals, ou o `sales` genérico),
 * já que não existe uma tabela única de vendas no CRM. Cobre o que
 * consultar_top_leads não cobre: cruzar "tempo sem comprar" com "valor da
 * última compra" — top_leads só olha contatos em geral, não transações reais.
 */
async function queryInactiveCustomers(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const diasMin = Number(input.dias_sem_comprar) || 30
  const valorMinimoCents = input.valor_minimo_ultima_compra ? Math.round(Number(input.valor_minimo_ultima_compra) * 100) : 0

  const niche = await resolveOrgNicheForTools(ctx)
  const transactions = niche === 'travel'
    ? await lastTransactionsTravel(ctx)
    : niche === 'clinic'
      ? await lastTransactionsClinic(ctx)
      : niche === 'real_estate'
        ? await lastTransactionsRealEstate(ctx)
        : await lastTransactionsGeneric(ctx)

  if (transactions.length === 0) {
    return { summary: 'Nenhuma venda/atendimento com cliente vinculado encontrado ainda.', view: { type: 'none' } }
  }

  const { data: contatos } = await ctx.supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', ctx.orgId)
    .in('id', transactions.map(t => t.contato_id))
  const nameById = new Map<string, string>((contatos || []).map((c: any) => [c.id, c.name]))

  const now = Date.now()
  const rows = transactions
    .map(t => ({ ...t, name: nameById.get(t.contato_id) || 'Cliente removido', days: Math.floor((now - new Date(t.date).getTime()) / 86_400_000) }))
    .filter(r => r.days >= diasMin && r.amount_cents >= valorMinimoCents)
    .sort((a, b) => b.days - a.days)

  if (rows.length === 0) {
    return { summary: `Nenhum cliente encontrado com ${diasMin}+ dias sem comprar${valorMinimoCents > 0 ? ` e última compra acima de ${fmtCurrency(valorMinimoCents)}` : ''}.`, view: { type: 'none' } }
  }

  const top = rows.slice(0, 30)
  const label = niche === 'clinic' ? 'atender' : 'comprar'
  return {
    summary: `${rows.length} clientes com ${diasMin}+ dias sem ${label}${valorMinimoCents > 0 ? ` e última compra acima de ${fmtCurrency(valorMinimoCents)}` : ''}. O mais antigo: ${top[0].name}, ${top[0].days} dias, última transação de ${fmtCurrency(top[0].amount_cents)}${top[0].extra ? ` (${top[0].extra})` : ''}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Dias sem comprar', 'Última transação', 'Detalhe', 'Data'],
      rows: top.map(r => [r.name, String(r.days), fmtCurrency(r.amount_cents), r.extra || '—', new Date(r.date).toLocaleDateString('pt-BR')]),
    },
  }
}

async function queryOffers(
  _input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('travel_showcase_packages')
    .select('category, is_published, total_cents')
    .eq('organization_id', ctx.orgId)

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhuma oferta/pacote cadastrado na vitrine.', view: { type: 'none' } }
  }

  const published = rows.filter(r => r.is_published).length
  const draft = rows.length - published
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    const k = r.category || 'Sem categoria'
    byCategory.set(k, (byCategory.get(k) || 0) + 1)
  }
  const barData = Array.from(byCategory.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: `${rows.length} ofertas na vitrine: ${published} publicadas e ${draft} em rascunho. Categorias: ${barData.map(c => `${c.name} (${c.value})`).join(', ')}.`,
    view: { type: 'bar', data: barData, color: '#f59e0b' },
  }
}

async function queryTasks(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  // Tarefas criadas no período + status atual. Vencidas = due_date no passado e
  // ainda não concluídas (independente da data de criação).
  const { data } = await ctx.supabase
    .from('tasks')
    .select('status, due_date, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma tarefa criada no período (${label}).`, view: { type: 'none' } }
  }

  const now = Date.now()
  let open = 0
  let doing = 0
  let done = 0
  let overdue = 0
  for (const t of rows) {
    const status = (t.status || 'open').toLowerCase()
    if (status === 'done') done += 1
    else if (status === 'doing') doing += 1
    else open += 1
    if (status !== 'done' && t.due_date && new Date(t.due_date).getTime() < now) overdue += 1
  }

  const items = [
    { label: 'Em aberto', value: String(open) },
    { label: 'Em andamento', value: String(doing) },
    { label: 'Concluídas', value: String(done) },
    { label: 'Vencidas', value: String(overdue) },
  ]

  return {
    summary: `${rows.length} tarefas no período (${label}): ${open} em aberto, ${doing} em andamento, ${done} concluídas e ${overdue} vencidas (atrasadas).`,
    view: { type: 'kpis', items },
  }
}

/* ------- Vertical Clínicas — só dado operacional/comercial, nunca
 * conteúdo clínico das observações de texto livre (ver docs/audit/
 * clinicas-lgpd.md). ------- */

async function queryClinicAttendances(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const [{ data: attendances }, { data: statusRows }] = await Promise.all([
    ctx.supabase
      .from('clinic_attendances')
      .select('professional_id, attended_at, total_cents, clinic_professionals(name), contatos(name)')
      .eq('organization_id', ctx.orgId)
      .gte('attended_at', start.toISOString())
      .order('attended_at', { ascending: false }),
    ctx.supabase
      .from('clinic_appointment_context')
      .select('clinic_status')
      .eq('organization_id', ctx.orgId)
      .gte('created_at', start.toISOString())
      .in('clinic_status', ['realizado', 'no_show']),
  ])

  const rows = (attendances as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum atendimento registrado no período (${label}).`, view: { type: 'none' } }
  }

  const byProf = new Map<string, number>()
  for (const a of rows) {
    const name = a.clinic_professionals?.name || 'Sem profissional'
    byProf.set(name, (byProf.get(name) || 0) + 1)
  }
  const barData = Array.from(byProf.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const total = (statusRows || []).length
  const noShow = (statusRows || []).filter((r: any) => r.clinic_status === 'no_show').length
  const noShowRate = total > 0 ? (noShow / total) * 100 : null

  // Lista de pacientes atendidos vai só no texto (nome é dado operacional
  // permitido pela regra do prompt — só o conteúdo clínico de texto livre é
  // vedado). Sem isso a IA não consegue responder "quem foi o último
  // paciente atendido".
  const recentList = rows.slice(0, 10).map((a: any) => `${a.contatos?.name || 'Paciente removido'} (${a.clinic_professionals?.name || 'sem profissional'}, ${new Date(a.attended_at).toLocaleDateString('pt-BR')})`).join('; ')

  return {
    summary: `${rows.length} atendimentos no período (${label}).${noShowRate !== null ? ` Taxa de no-show: ${noShowRate.toFixed(1)}%.` : ''} Por profissional: ${barData.map(b => `${b.name} (${b.value})`).join(', ')}. Mais recentes: ${recentList}.`,
    view: { type: 'bar', data: barData, color: '#0ea5e9' },
  }
}

async function queryClinicCommissions(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data } = await ctx.supabase
    .from('clinic_commissions')
    .select('commission_cents, status, clinic_professionals(name)')
    .eq('organization_id', ctx.orgId)
    .gte('competencia', start.toISOString().slice(0, 10))

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma comissão calculada no período (${label}).`, view: { type: 'none' } }
  }

  const pendingCents = rows.filter(r => r.status === 'pendente').reduce((a, r) => a + r.commission_cents, 0)
  const paidCents = rows.filter(r => r.status === 'pago').reduce((a, r) => a + r.commission_cents, 0)

  const byProf = new Map<string, number>()
  for (const r of rows) {
    const name = r.clinic_professionals?.name || 'Sem profissional'
    byProf.set(name, (byProf.get(name) || 0) + r.commission_cents)
  }
  const barData = Array.from(byProf.entries())
    .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: `Comissões no período (${label}): ${fmtCurrency(pendingCents)} pendentes e ${fmtCurrency(paidCents)} pagas. Por profissional: ${barData.map(b => `${b.name} (${fmtCurrency(b.value * 100)})`).join(', ')}.`,
    view: { type: 'bar', data: barData, color: '#10b981' },
  }
}

async function queryProcedures(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data: eventTypes } = await ctx.supabase
    .from('event_types')
    .select('id, name, is_active')
    .eq('organization_id', ctx.orgId)

  const rows = (eventTypes as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum procedimento cadastrado.', view: { type: 'none' } }
  }

  const { data: ctxRows } = await ctx.supabase
    .from('clinic_service_context')
    .select('event_type_id, price_cents')
    .eq('organization_id', ctx.orgId)

  const priceByEventType = new Map<string, number>()
  for (const c of (ctxRows as any[]) || []) priceByEventType.set(c.event_type_id, c.price_cents || 0)

  const active = rows.filter(r => r.is_active).length
  const priced = rows.map(r => priceByEventType.get(r.id) || 0).filter(p => p > 0)
  const avgPrice = priced.length > 0 ? priced.reduce((a, p) => a + p, 0) / priced.length : 0

  return {
    summary: `${rows.length} procedimentos cadastrados, ${active} ativos. Preço médio: ${fmtCurrency(avgPrice)}.`,
    view: {
      type: 'table',
      columns: ['Procedimento', 'Status', 'Preço'],
      rows: rows.map(r => [r.name, r.is_active ? 'Ativo' : 'Pausado', priceByEventType.get(r.id) ? fmtCurrency(priceByEventType.get(r.id)!) : '—']),
    },
  }
}

async function queryTreatments(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('clinic_packages')
    .select('name, total_sessions, sessions_used, value_cents, status, valid_until')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum tratamento/pacote vendido no período (${label}).`, view: { type: 'none' } }
  }

  const active = rows.filter(r => r.status === 'ativo' || r.status === 'active').length
  const totalValue = rows.reduce((a, r) => a + (r.value_cents || 0), 0)
  const soon = new Date()
  soon.setDate(soon.getDate() + 15)
  const expiringSoon = rows.filter(r => r.valid_until && new Date(r.valid_until) <= soon && new Date(r.valid_until) >= new Date()).length

  const items = [
    { label: 'Pacotes vendidos', value: String(rows.length) },
    { label: 'Ativos', value: String(active) },
    { label: 'Valor total', value: fmtCurrency(totalValue) },
    { label: 'Vencendo em 15 dias', value: String(expiringSoon) },
  ]

  return {
    summary: `${rows.length} tratamentos/pacotes no período (${label}), ${active} ativos, valor total ${fmtCurrency(totalValue)}. ${expiringSoon} vencendo nos próximos 15 dias.`,
    view: { type: 'kpis', items },
  }
}

async function queryStock(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data: supplies } = await ctx.supabase
    .from('clinic_supplies')
    .select('id, name, unit, quantity_in_stock, min_stock_alert, last_unit_cost_cents')
    .eq('organization_id', ctx.orgId)
    .eq('active', true)

  const rows = (supplies as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum insumo cadastrado no estoque.', view: { type: 'none' } }
  }

  let totalValueCents = 0
  const lowStock: string[] = []
  for (const s of rows) {
    totalValueCents += Math.round(Number(s.quantity_in_stock) * (s.last_unit_cost_cents || 0))
    if (s.min_stock_alert != null && Number(s.quantity_in_stock) <= Number(s.min_stock_alert)) lowStock.push(s.name)
  }

  const { data: consumption } = await ctx.supabase
    .from('clinic_supply_consumption_log')
    .select('quantity, supply_id, clinic_supplies(name, unit)')
    .eq('organization_id', ctx.orgId)
    .eq('source', 'atendimento')
    .gte('consumed_at', start.toISOString())

  const byItem = new Map<string, { qty: number; unit: string }>()
  for (const c of (consumption as any[]) || []) {
    const name = c.clinic_supplies?.name || 'Insumo removido'
    const prev = byItem.get(name) || { qty: 0, unit: c.clinic_supplies?.unit || 'un' }
    prev.qty += Number(c.quantity)
    byItem.set(name, prev)
  }
  const topConsumed = Array.from(byItem.entries())
    .map(([name, v]) => ({ name, value: v.qty }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return {
    summary: `${rows.length} insumos ativos no estoque, valor total ${fmtCurrency(totalValueCents)}. ${lowStock.length} com estoque baixo${lowStock.length > 0 ? ` (${lowStock.slice(0, 5).join(', ')}${lowStock.length > 5 ? '...' : ''})` : ''}. Mais consumidos no período (${label}): ${topConsumed.slice(0, 5).map(t => `${t.name} (${t.value})`).join(', ') || 'sem consumo registrado'}.`,
    view: topConsumed.length > 0
      ? { type: 'bar', data: topConsumed, color: '#f59e0b' }
      : { type: 'none' },
  }
}

/* ------- Vertical Imobiliárias ------- */

async function queryProperties(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('properties')
    .select('status, purpose, price_cents')
    .eq('organization_id', ctx.orgId)

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum imóvel cadastrado.', view: { type: 'none' } }
  }

  const byStatus = new Map<string, number>()
  for (const r of rows) byStatus.set(r.status || 'sem status', (byStatus.get(r.status || 'sem status') || 0) + 1)
  const pieData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))

  const priced = rows.map(r => r.price_cents || 0).filter(p => p > 0)
  const avgPrice = priced.length > 0 ? priced.reduce((a, p) => a + p, 0) / priced.length : 0

  return {
    summary: `${rows.length} imóveis no portfólio. Distribuição por status: ${Array.from(byStatus.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}. Preço médio: ${fmtCurrency(avgPrice)}.`,
    view: { type: 'pie', data: pieData },
  }
}

async function queryVisits(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('property_visits')
    .select('status, broker_user_id')
    .eq('organization_id', ctx.orgId)
    .gte('scheduled_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma visita agendada no período (${label}).`, view: { type: 'none' } }
  }

  const byBroker = new Map<string, number>()
  for (const r of rows) {
    const k = r.broker_user_id || 'Sem corretor'
    byBroker.set(k, (byBroker.get(k) || 0) + 1)
  }
  const barData = Array.from(byBroker.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const done = rows.filter(r => r.status === 'realizada' || r.status === 'done').length
  const canceled = rows.filter(r => r.status === 'cancelada' || r.status === 'canceled').length

  return {
    summary: `${rows.length} visitas no período (${label}): ${done} realizadas, ${canceled} canceladas.`,
    view: { type: 'bar', data: barData, color: '#0ea5e9' },
  }
}

async function queryDeals(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('property_deals')
    .select('deal_type, final_price_cents, commission_cents, monthly_rent_cents, status, closed_at, contatos(name), properties(title)')
    .eq('organization_id', ctx.orgId)
    .gte('closed_at', start.toISOString())
    .order('closed_at', { ascending: false })

  const rows = ((data as any[]) || []).filter(r => r.status !== 'cancelado')
  if (rows.length === 0) {
    return { summary: `Nenhuma negociação fechada no período (${label}).`, view: { type: 'none' } }
  }

  const totalValue = rows.reduce((a, r) => a + (r.final_price_cents || r.monthly_rent_cents || 0), 0)
  const totalCommission = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const sales = rows.filter(r => r.deal_type === 'venda').length
  const rentals = rows.filter(r => r.deal_type === 'locacao').length

  // Lista de clientes/imóveis vai só no texto — sem isso a IA não consegue
  // responder "quem foi o cliente da negociação mais recente".
  const recentList = rows.slice(0, 10).map((r: any) => `${r.contatos?.name || 'Cliente removido'} — ${r.properties?.title || 'imóvel removido'} (${fmtCurrency(r.final_price_cents || r.monthly_rent_cents || 0)}, ${new Date(r.closed_at).toLocaleDateString('pt-BR')})`).join('; ')

  const items = [
    { label: 'Negociações fechadas', value: String(rows.length) },
    { label: 'Vendas', value: String(sales) },
    { label: 'Locações', value: String(rentals) },
    { label: 'Valor total', value: fmtCurrency(totalValue) },
    { label: 'Comissão total', value: fmtCurrency(totalCommission) },
  ]

  return {
    summary: `${rows.length} negociações fechadas no período (${label}): ${sales} vendas, ${rentals} locações, valor total ${fmtCurrency(totalValue)}, comissão ${fmtCurrency(totalCommission)}. Mais recentes: ${recentList}.`,
    view: { type: 'kpis', items },
  }
}
