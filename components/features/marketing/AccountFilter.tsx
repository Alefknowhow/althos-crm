'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Building2 } from 'lucide-react'

type Account = { id: string; name: string }

export default function AccountFilter({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[]
  selected: Set<string> | 'all'
  onChange: (next: Set<string> | 'all') => void
}) {
  if (accounts.length <= 1) return null // nada pra filtrar com 0-1 conta

  const isAll = selected === 'all'
  const count = isAll ? accounts.length : selected.size

  function toggle(id: string) {
    const current = isAll ? new Set(accounts.map(a => a.id)) : new Set(selected)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    onChange(current.size === accounts.length ? 'all' : current)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="w-3.5 h-3.5 mr-1.5" />
          {isAll ? 'Todas as contas' : `${count} conta${count === 1 ? '' : 's'}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="space-y-1.5">
          {accounts.map(a => (
            <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={isAll || selected.has(a.id)}
                onCheckedChange={() => toggle(a.id)}
              />
              <span className="truncate">{a.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
