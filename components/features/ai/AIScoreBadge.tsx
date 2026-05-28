import { Sparkles } from 'lucide-react'

type Props = {
  score: number | null | undefined
  tier?: 'hot' | 'warm' | 'cold' | string | null
  summary?: string | null
  size?: 'sm' | 'md'
}

const TIER_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  warm: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  cold: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
}

const TIER_LABEL: Record<string, string> = {
  hot: 'Quente',
  warm: 'Morno',
  cold: 'Frio',
}

export default function AIScoreBadge({ score, tier, summary, size = 'md' }: Props) {
  if (score == null || tier == null) return null
  const t = String(tier)
  const style = TIER_STYLES[t] || 'bg-muted text-muted-foreground'
  const cls = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <div
      title={summary || ''}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style} ${cls}`}
    >
      <Sparkles className="w-3 h-3" />
      <span className="font-semibold">{score}</span>
      <span className="opacity-70">·</span>
      <span>{TIER_LABEL[t] || t}</span>
    </div>
  )
}
