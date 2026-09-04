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
    name: 'consultar_cotacao_completa',
    description:
      'Vertical Viagens: mergulho completo numa cotação/proposta específica — status, período, destinos, voos/hotéis propostos, valor, e o link público de compartilhamento (quando já existir). Use quando o usuário pedir detalhes de UMA cotação/cliente específico. Pra pedidos genéricos ("me manda a cotação de X", "detalhes da proposta de X"), prefira responder com o LINK PÚBLICO em vez de listar tudo que está dentro dela — só entre em detalhe de um campo específico (valor, data, destino) quando a pergunta pedir exatamente isso.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Nome do cliente ou título da cotação. Aceita nome parcial.' },
      },
      required: ['busca'],
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
