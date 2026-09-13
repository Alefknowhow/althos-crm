import { Progress } from '@/components/ui/progress'

/** Uma linha de "Uso atual" (leads/WhatsApp/e-mails/usuários) com barra de
 *  progresso — extraída de page.tsx (arquivo passou do limite de linhas do lint). */
export function UsageRow({
  icon, label, used, limit, pct,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number
  pct: number
}) {
  const isUnlimited = !isFinite(limit)
  const isHigh = pct >= 80

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-medium tabular-nums ${isHigh ? 'text-destructive' : ''}`}>
          {used.toLocaleString('pt-BR')}
          {!isUnlimited && ` / ${limit.toLocaleString('pt-BR')}`}
          {isUnlimited && ' / ∞'}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(pct, 100)}
          className={isHigh ? '[&>div]:bg-destructive' : ''}
        />
      )}
    </div>
  )
}
