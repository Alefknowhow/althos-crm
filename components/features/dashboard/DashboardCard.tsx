import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import MockBadge from './MockBadge'

/**
 * Casca padrão dos widgets do dashboard v2: título + subtítulo + ação
 * opcional no header, corpo com altura fixa (nunca cresce por conteúdo —
 * `heightClass` vem de dashboardSizes.ts; o que não cabe rola dentro).
 * Server-safe (sem hooks) — pode envolver tanto conteúdo server quanto
 * componentes client.
 */
export default function DashboardCard({
  title,
  help,
  icon: Icon,
  iconClassName,
  heightClass,
  action,
  mock,
  scroll = false,
  bodyClassName,
  children,
}: {
  title: string
  help?: string
  icon?: LucideIcon
  iconClassName?: string
  heightClass: string
  action?: React.ReactNode
  mock?: boolean
  /** Corpo com scroll vertical interno (listas). */
  scroll?: boolean
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn(heightClass, 'flex flex-col overflow-hidden min-w-0')}>
      <CardHeader className="pb-2 shrink-0 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {Icon && <Icon className={cn('w-4 h-4 shrink-0 text-primary', iconClassName)} />}
              <span className="truncate">{title}</span>
              {mock && <MockBadge />}
            </CardTitle>
            {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn('flex-1 min-h-0', scroll && 'overflow-y-auto', bodyClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

/** Estado vazio padronizado dentro de um DashboardCard. */
export function EmptyChart({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1 px-4">
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="text-[11px] text-muted-foreground/80 max-w-[320px]">{hint}</p>}
    </div>
  )
}
