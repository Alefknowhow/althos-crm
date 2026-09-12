import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

/**
 * Linha de lista M3 — mínimo 64px, identidade + valor dominante + status +
 * prazo/responsável visíveis sem abrir o registro (spec mobile G1, 4.6).
 * `as="button"` quando a linha inteira é clicável (semântica de botão, não
 * botão aninhado dentro de outro controle clicável).
 */
export function MobileListItem({
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'flex items-center gap-3 min-h-[64px] w-full px-4 py-2 text-left rounded-mcard',
        onClick && 'hover:bg-m3-surface-container transition-colors',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-m3-on-surface truncate">{title}</p>
        {subtitle && <p className="text-sm text-m3-on-surface-variant truncate">{subtitle}</p>}
      </div>
      {trailing}
      {onClick && <ChevronRight className="w-5 h-5 text-m3-on-surface-variant shrink-0" />}
    </Comp>
  )
}
