'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { Settings2 } from 'lucide-react'
import { ALL_COLUMNS, type ColKey } from './LeadsViewShared'

/* -------- Columns toggle -------- */

export default function ColumnsMenu({
  hiddenCols,
  onToggle,
}: {
  hiddenCols: Set<ColKey>
  onToggle: (k: ColKey, hidden: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Colunas">
          <Settings2 className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Colunas</DropdownMenuLabel>
        {ALL_COLUMNS.map(c => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={!hiddenCols.has(c.key)}
            onCheckedChange={checked => onToggle(c.key, !checked)}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
