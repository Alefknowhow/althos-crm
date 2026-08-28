'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Building2, Check } from 'lucide-react'

type Account = { id: string; name: string }

/**
 * Seleção de UMA conta por vez pros gráficos/tabela — misturar métricas de
 * contas diferentes na mesma série/tabela confundia mais do que ajudava.
 * Dobra como badge "Exibindo: X" sempre visível (só vira dropdown clicável
 * quando há mais de uma conta pra escolher).
 */
export default function AccountFilter({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[]
  selected: string | null
  onChange: (id: string) => void
}) {
  if (accounts.length === 0) return null

  const current = accounts.find(a => a.id === selected) ?? accounts[0]

  if (accounts.length === 1) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs text-muted-foreground">
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        Exibindo: <span className="font-medium text-foreground">{current.name}</span>
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <Building2 className="w-3.5 h-3.5" />
          Exibindo: <span className="font-medium">{current.name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {accounts.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">{a.name}</span>
            {a.id === current.id && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
