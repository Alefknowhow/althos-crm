'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { FIELD_TYPES } from './FieldTypeMeta'

/** Popover de seleção de tipo de pergunta — reaproveitado pelo "+" da
 *  sidebar (cria pergunta nova) e pelo seletor de tipo no painel de
 *  propriedades (troca o tipo da pergunta selecionada). */
export default function FieldTypePicker({
  trigger,
  onSelect,
}: {
  trigger: React.ReactNode
  onSelect: (type: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = FIELD_TYPES.filter(f =>
    f.label.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery('') }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="relative mb-1.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar tipo..."
            className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {filtered.map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => { onSelect(f.type); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded ${f.colorClass} shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {f.label}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum tipo encontrado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
