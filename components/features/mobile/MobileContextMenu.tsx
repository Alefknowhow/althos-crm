'use client'

import { MobileBottomSheet } from './MobileBottomSheet'
import { cn } from '@/lib/utils'

export type MobileMenuAction = {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

/**
 * Menu de ações (⋮) M3 — bottom sheet, itens com alvo mínimo 48px, ícone +
 * rótulo completo (nunca ícone sozinho pra ação sensível — spec mobile G3/
 * 4.4). Agrupe por seção passando arrays separados; um separador visual
 * aparece entre grupos não-vazios.
 */
export function MobileContextMenu({
  open,
  onOpenChange,
  title,
  groups,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  groups: MobileMenuAction[][]
}) {
  const nonEmptyGroups = groups.filter(g => g.length > 0)
  return (
    <MobileBottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="divide-y divide-m3-outline-variant/60">
        {nonEmptyGroups.map((group, i) => (
          <div key={i} className="py-1 first:pt-0 last:pb-0">
            {group.map(action => (
              <button
                key={action.key}
                type="button"
                disabled={action.disabled}
                onClick={() => { action.onClick(); onOpenChange(false) }}
                className={cn(
                  'w-full flex items-center gap-3 min-h-[48px] px-2 rounded-mcard text-left text-base disabled:opacity-40',
                  action.destructive ? 'text-destructive' : 'text-m3-on-surface',
                  !action.disabled && 'hover:bg-m3-surface-container',
                )}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </MobileBottomSheet>
  )
}
