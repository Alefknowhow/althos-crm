'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VerticalTabItem = {
  key: string
  label: string
  icon?: LucideIcon
  /** Presente → item navega por rota (Link). Ausente → chama onSelect (estado local). */
  href?: string
  badge?: number
}

/**
 * Navegação vertical em coluna — base compartilhada pra Configurações
 * (nível principal + sub-nav do Agente IA) e pro workspace de Clientes
 * (Tráfego). Dois modos de uso por item: `href` (navega por rota, ex.:
 * Configurações) ou `onSelect` (estado local controlado, ex.: abas do
 * ClientDetailShell). Estilo "quadrado" (rounded-lg, não pill) — reserva o
 * rounded-full pras Tabs horizontais existentes (components/ui/tabs.tsx),
 * que continuam como estão em todo o resto do app.
 */
export function VerticalTabsNav({
  items, activeKey, onSelect, compact = false, className,
}: {
  items: VerticalTabItem[]
  activeKey: string
  onSelect?: (key: string) => void
  compact?: boolean
  className?: string
}) {
  return (
    <nav className={cn('sidebar-scroll flex flex-col gap-0.5 overflow-y-auto', compact ? 'w-40' : 'w-52', className)}>
      {items.map(item => {
        const active = item.key === activeKey
        const Icon = item.icon
        const content = (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
            <span className="truncate flex-1 text-left">{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="text-[11px] font-medium text-muted-foreground">{item.badge}</span>
            )}
          </>
        )
        const itemClassName = cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
        )
        return item.href ? (
          <Link key={item.key} href={item.href} className={itemClassName}>{content}</Link>
        ) : (
          <button key={item.key} type="button" onClick={() => onSelect?.(item.key)} className={itemClassName}>
            {content}
          </button>
        )
      })}
    </nav>
  )
}
