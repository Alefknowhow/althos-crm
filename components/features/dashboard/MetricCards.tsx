import { Card, CardContent } from '@/components/ui/card'
import { Users, Target, CheckCircle2, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MetricCardsProps {
  metrics: {
    newLeads: { value: number; change: number }
    conversions: { value: number; change: number }
    completedTasks: { value: number }
    revenue: { value: number }
  }
}

interface MetricCardData {
  title: string
  value: string | number
  icon: LucideIcon
  change?: number
  description: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)

function ChangeChip({ change }: { change: number }) {
  if (change === 0) return null
  const isPositive = change > 0
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tracking-apple-snug ${
        isPositive
          ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  const cards: MetricCardData[] = [
    {
      title: 'Leads novos',
      value: metrics.newLeads.value,
      icon: Users,
      change: metrics.newLeads.change,
      description: 'no período',
    },
    {
      title: 'Conversões',
      value: metrics.conversions.value,
      icon: Target,
      change: metrics.conversions.change,
      description: 'leads fechados',
    },
    {
      title: 'Tarefas concluídas',
      value: metrics.completedTasks.value,
      icon: CheckCircle2,
      description: 'no período',
    },
    {
      title: 'Receita',
      value: formatCurrency(metrics.revenue.value),
      icon: DollarSign,
      description: 'total fechado',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <Card key={card.title} className="reveal apple-hover-lift">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {card.title}
                </p>
                <div className="rounded-full bg-secondary p-2 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-[32px] font-semibold leading-none tracking-apple-tighter text-foreground">
                {card.value}
              </div>
              <div className="flex items-center gap-2 mt-3">
                {card.change !== undefined && <ChangeChip change={card.change} />}
                <p className="text-xs text-muted-foreground tracking-apple-snug">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
