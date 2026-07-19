import Link from 'next/link'
import { AlertTriangle, TrendingDown, TrendingUp, Info, Sparkles } from 'lucide-react'
import { listDashboardInsights } from '@/actions/dashboard-insights'
import MockInsightCard from './mocks/MockInsightCard'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'alert-triangle': AlertTriangle,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
}

const KIND_STYLES = {
  risk: 'border-red-300/60 bg-red-500/5 text-red-700 dark:text-red-400',
  opportunity: 'border-emerald-300/60 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  info: 'border-border bg-muted/40 text-foreground',
} as const

// Heurística leve: cada aba tem palavras-chave que aparecem no deep_link ou
// no texto dos insights reais (gerados pelo job Inngest). Quando nenhum
// insight bate, cai no fallback mockado — mesmo tratamento das métricas sem
// fonte real.
const TAB_KEYWORDS: Record<string, string[]> = {
  'visao-geral': [],
  comercial: ['/pipeline', 'funil', 'conversão', 'lead'],
  'vendas-clientes': ['/vendas', 'venda', 'cliente', 'receita'],
  'equipe-atendimento': ['/equipe', 'vendedor', 'resposta', 'atendimento'],
}

const MOCK_FALLBACK: Record<string, string> = {
  'visao-geral': 'Nenhum sinal relevante no momento — sua operação está estável comparado ao período anterior.',
  comercial: 'Uma campanha específica concentra a maior parte das conversões recentes — considere realocar orçamento.',
  'vendas-clientes': '3 clientes VIP não compram há mais de 60 dias — vale um contato de reativação.',
  'equipe-atendimento': 'Um vendedor concentra mais de 50% dos leads atribuídos — considere redistribuir.',
}

export default async function InsightCard({ orgSlug, tab }: { orgSlug: string; tab: string }) {
  const insights = await listDashboardInsights(orgSlug)
  const keywords = TAB_KEYWORDS[tab] || []

  const match = tab === 'visao-geral'
    ? insights[0]
    : insights.find(i => keywords.some(k => (i.deep_link || '').includes(k) || i.text.toLowerCase().includes(k)))

  if (!match) {
    return <MockInsightCard text={MOCK_FALLBACK[tab] || 'Sem insight disponível para esta aba ainda.'} />
  }

  const Icon = (match.icon && ICONS[match.icon]) || Info
  const href = `/app/${orgSlug}${match.deep_link || ''}`

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${KIND_STYLES[match.kind]}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-sm flex-1">{match.text}</span>
      <Link href={href} className="text-xs underline underline-offset-2 shrink-0 hover:opacity-80">
        ver
      </Link>
      <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-50" />
    </div>
  )
}
