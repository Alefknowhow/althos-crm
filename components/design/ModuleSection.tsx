/**
 * Seção em card (issue #59/#60 Fase C.2) — usado dentro das abas internas de
 * um módulo pra agrupar conteúdo com o mesmo visual das referências do
 * usuário: card branco arredondado, título pequeno em caixa-alta cinza.
 * Puramente visual — sem lógica, sem estado.
 */

import { cn } from '@/lib/utils'

export default function ModuleSection({
  title, children, className, contentClassName, headerExtra,
}: {
  title: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
  /** Conteúdo à direita do título — ex.: um botão discreto de ação da seção. */
  headerExtra?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {headerExtra}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  )
}
