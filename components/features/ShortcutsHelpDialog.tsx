'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { ShortcutEntry } from '@/lib/shortcuts/registry'

function formatCombo(combo: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  return combo
    .split('+')
    .map(part => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl'
      if (part === 'shift') return 'Shift'
      if (part === 'alt') return isMac ? '⌥' : 'Alt'
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join(isMac ? '' : '+')
}

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: ShortcutEntry[]
}) {
  const groups = new Map<string, ShortcutEntry[]>()
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? []
    list.push(entry)
    groups.set(entry.group, list)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Disponíveis no contexto atual da tela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{group}</p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.combo} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{item.description}</span>
                    <kbd className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-muted border border-border text-[11px] font-mono">
                      {formatCombo(item.combo)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum atalho registrado nesta tela.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
