import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAP = {
  alto: { label: 'Alto', cls: 'bg-destructive/12 text-destructive', Icon: AlertTriangle },
  medio: { label: 'Médio', cls: 'bg-warning/15 text-warning', Icon: AlertCircle },
  baixo: { label: 'Baixo', cls: 'bg-muted text-muted-foreground', Icon: Info },
} as const

/** Selo de risco — cor de status sempre acompanhada de ícone + texto. */
export default function RiskBadge({ risk }: { risk: keyof typeof MAP }) {
  const { label, cls, Icon } = MAP[risk]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium shrink-0', cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}
