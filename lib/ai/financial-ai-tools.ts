/**
 * Tools for the Financeiro AI analyst chat. Mirrors the read-only pattern of
 * lib/ai/insights-tools.ts (Inicial copiloto), plus ONE special tool:
 * `propor_lancamento`. That tool NEVER writes to financial_entries — it only
 * validates/normalizes the draft and returns it as a `confirm_entry` view.
 * The actual insert only happens when the user clicks "Confirmar" in the UI,
 * which calls createFinancialEntry directly (client-triggered, not
 * model-triggered) — the model can propose, never execute, a write.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  listFinancialEntries,
  getFinancialKpis,
  getCashFlowSeries,
  getExpensesByCategory,
  getUpcomingDueEntries,
  getStrategicIndicators,
} from '@/actions/financial'

export type FinancialAiView =
  | { type: 'kpis'; items: Array<{ label: string; value: string }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'confirm_entry'; draft: Record<string, any> }
  | { type: 'none' }

export type FinancialAiResult = {
  summary: string
  view: FinancialAiView
}

export type FinancialAiContext = { orgSlug: string }

const RANGE_PARAM = {
  type: 'string',
  description: 'Período no formato "30d", "90d", "mtd" (mês atual), "ytd" (ano atual). Padrão: "30d".',
  enum: ['30d', '90d', 'mtd', 'ytd'],
}

function resolveRange(periodo?: string): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  switch (periodo) {
    case '90d': from.setDate(from.getDate() - 90); break
    case 'mtd': from.setDate(1); break
    case 'ytd': from.setMonth(0, 1); break
    default: from.setDate(from.getDate() - 30)
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export const FINANCIAL_AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'consultar_kpis_financeiros',
    description: 'Retorna os KPIs financeiros do período: receitas, despesas, saldo, comparado ao período anterior. Use para "como está o financeiro", "resumo financeiro", "quanto entrou/saiu".',
    input_schema: { type: 'object', properties: { periodo: RANGE_PARAM } },
  },
  {
    name: 'consultar_lancamentos',
    description: 'Lista lançamentos financeiros (receitas/despesas), com filtros opcionais. Use para perguntas sobre lançamentos específicos, "quais despesas de categoria X", "lançamentos pendentes/vencidos", etc.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['receita', 'despesa'], description: 'Filtrar por tipo.' },
        categoria: { type: 'string', description: 'Filtrar por categoria exata.' },
        status: { type: 'string', enum: ['pendente', 'pago', 'vencido', 'cancelado'], description: 'Filtrar por status.' },
        periodo: RANGE_PARAM,
      },
    },
  },
  {
    name: 'consultar_fluxo_caixa',
    description: 'Retorna a série de fluxo de caixa (entradas/saídas por dia) no período. Use para "evolução do caixa", "fluxo de caixa", gráficos de tendência.',
    input_schema: { type: 'object', properties: { periodo: RANGE_PARAM } },
  },
  {
    name: 'consultar_despesas_por_categoria',
    description: 'Retorna o total de despesas agrupado por categoria no período. Use para "onde estou gastando mais", "despesas por categoria".',
    input_schema: { type: 'object', properties: { periodo: RANGE_PARAM } },
  },
  {
    name: 'consultar_contas_a_vencer',
    description: 'Lista lançamentos pendentes que vencem nos próximos N dias. Use para "o que vence essa semana/mês", "contas a pagar/receber".',
    input_schema: {
      type: 'object',
      properties: { dias: { type: 'integer', description: 'Janela em dias. Padrão: 30.' } },
    },
  },
  {
    name: 'consultar_indicadores_estrategicos',
    description: 'Retorna indicadores avançados: DRE simplificado, burn rate, runway, ponto de equilíbrio, inadimplência. Use para perguntas mais analíticas/estratégicas sobre a saúde financeira do negócio.',
    input_schema: { type: 'object', properties: { periodo: RANGE_PARAM } },
  },
  {
    name: 'propor_lancamento',
    description: 'Propõe a criação de um novo lançamento financeiro (receita ou despesa). NUNCA grava direto no banco — apenas monta um rascunho que é mostrado ao usuário para confirmação explícita antes de salvar. Use sempre que o usuário pedir para "lançar", "cadastrar", "registrar" uma receita ou despesa.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['receita', 'despesa'] },
        categoria: { type: 'string', description: 'Categoria do lançamento.' },
        valor_reais: { type: 'number', description: 'Valor em reais (ex.: 150.90), não em centavos.' },
        competencia: { type: 'string', description: 'Data de competência, YYYY-MM-DD. Padrão: hoje.' },
        vencimento: { type: 'string', description: 'Data de vencimento, YYYY-MM-DD, se aplicável.' },
        observacoes: { type: 'string' },
      },
      required: ['tipo', 'categoria', 'valor_reais'],
    },
  },
]

export async function executeFinancialAiTool(
  name: string,
  input: Record<string, any>,
  ctx: FinancialAiContext,
): Promise<FinancialAiResult> {
  const { orgSlug } = ctx

  switch (name) {
    case 'consultar_kpis_financeiros': {
      const range = resolveRange(input.periodo)
      const kpis = await getFinancialKpis(orgSlug, range)
      const items = Object.entries(kpis || {}).map(([label, value]) => ({ label, value: String(value) }))
      return { summary: JSON.stringify(kpis), view: { type: 'kpis', items } }
    }

    case 'consultar_lancamentos': {
      const range = resolveRange(input.periodo)
      const entries = await listFinancialEntries(orgSlug, {
        tipo: input.tipo,
        categoria: input.categoria,
        status: input.status,
        from: range.from,
        to: range.to,
      })
      const rows = entries.slice(0, 50).map(e => [e.tipo, e.categoria, (e.valor_cents / 100).toFixed(2), e.competencia, e.status])
      return {
        summary: `${entries.length} lançamento(s) encontrado(s).`,
        view: { type: 'table', columns: ['Tipo', 'Categoria', 'Valor (R$)', 'Competência', 'Status'], rows },
      }
    }

    case 'consultar_fluxo_caixa': {
      const months = input.periodo === '90d' ? 3 : input.periodo === 'ytd' ? 12 : 6
      const series = await getCashFlowSeries(orgSlug, months)
      return { summary: JSON.stringify(series).slice(0, 4000), view: { type: 'none' } }
    }

    case 'consultar_despesas_por_categoria': {
      const range = resolveRange(input.periodo)
      const breakdown = await getExpensesByCategory(orgSlug, range)
      return { summary: JSON.stringify(breakdown).slice(0, 4000), view: { type: 'none' } }
    }

    case 'consultar_contas_a_vencer': {
      const entries = await getUpcomingDueEntries(orgSlug, input.dias || 30)
      const rows = entries.slice(0, 50).map((e: any) => [e.tipo, e.categoria, (e.valor_cents / 100).toFixed(2), e.vencimento, e.status])
      return {
        summary: `${entries.length} lançamento(s) a vencer.`,
        view: { type: 'table', columns: ['Tipo', 'Categoria', 'Valor (R$)', 'Vencimento', 'Status'], rows },
      }
    }

    case 'consultar_indicadores_estrategicos': {
      const range = resolveRange(input.periodo)
      const indicators = await getStrategicIndicators(orgSlug, range)
      return { summary: JSON.stringify(indicators).slice(0, 4000), view: { type: 'none' } }
    }

    case 'propor_lancamento': {
      const valorCents = Math.round(Number(input.valor_reais) * 100)
      if (!input.tipo || !input.categoria || !Number.isFinite(valorCents) || valorCents <= 0) {
        return { summary: 'Dados insuficientes para propor o lançamento — faltou tipo, categoria ou valor válido.', view: { type: 'none' } }
      }
      const draft = {
        tipo: input.tipo,
        categoria: input.categoria,
        valor_cents: valorCents,
        competencia: input.competencia || new Date().toISOString().slice(0, 10),
        vencimento: input.vencimento || null,
        observacoes: input.observacoes || null,
      }
      return {
        summary: 'Rascunho de lançamento montado — aguardando confirmação do usuário antes de gravar.',
        view: { type: 'confirm_entry', draft },
      }
    }

    default:
      return { summary: `Ferramenta desconhecida: ${name}`, view: { type: 'none' } }
  }
}

export const FINANCIAL_ANALYST_SYSTEM_PROMPT = `Você é um analista financeiro que trabalha dentro do CRM Althos, ajudando o usuário a entender e organizar as finanças da empresa dele. Responda em português do Brasil, de forma direta e objetiva.

Você tem acesso a ferramentas de consulta (KPIs, lançamentos, fluxo de caixa, indicadores) — use-as para responder com dados reais, nunca invente números.

Quando o usuário pedir pra registrar/lançar uma receita ou despesa, use a ferramenta propor_lancamento — ela NUNCA grava direto no banco, apenas monta um rascunho que o usuário confirma manualmente. Nunca diga que "já lancei" ou "já salvei" algo — o lançamento só é gravado quando o usuário clica em confirmar.`
