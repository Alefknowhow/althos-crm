/**
 * Seção em card (issue #59/#60 Fase C.2) — usado dentro das abas internas de
 * um módulo pra agrupar conteúdo com o mesmo visual das referências do
 * usuário: card branco arredondado, título pequeno em caixa-alta cinza.
 * Puramente visual — sem lógica, sem estado.
 */

import { cn } from '@/lib/utils'

export default function ModuleSection({
  title, children, className, contentClassName,
}: {
  title: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4 space-y-3', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className={contentClassName}>{children}</div>
    </div>
  )
}
