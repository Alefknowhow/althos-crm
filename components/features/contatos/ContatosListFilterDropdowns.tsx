import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const PILL_TRIGGER = 'inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)]'

/** Dropdown "Status: X" da toolbar de Contatos — server component, os
 *  links já navegam (sem estado client). Split de page.tsx só pra ficar
 *  dentro do limite de linhas do arquivo. */
export function StatusFilterDropdown({
  tabs, active, buildHref,
}: {
  tabs: { value: string; label: string }[]
  active: { value: string; label: string }
  buildHref: (value: string) => string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={PILL_TRIGGER}>
          Status: <span className="font-semibold">{active.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {tabs.map(tab => (
          <DropdownMenuItem key={tab.value || 'all'} asChild>
            <Link href={buildHref(tab.value)}>{tab.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Dropdown "Responsável: X" da toolbar de Contatos. */
export function ResponsavelFilterDropdown({
  members, activeName, buildHref,
}: {
  members: { id: string; name: string }[]
  activeName: string | undefined
  buildHref: (value: string) => string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={PILL_TRIGGER}>
          Responsável: <span className="font-semibold">{activeName || 'Todos'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <Link href={buildHref('')}>Todos</Link>
        </DropdownMenuItem>
        {members.map(m => (
          <DropdownMenuItem key={m.id} asChild>
            <Link href={buildHref(m.id)}>{m.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
