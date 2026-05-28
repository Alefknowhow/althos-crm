'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { searchLeads } from '@/actions/leads'

type Lead = { id: string; name: string; email?: string | null; phone?: string | null }

interface Props {
  name: string
  orgSlug: string
  defaultLead?: Lead | null
  placeholder?: string
  onChange?: (lead: Lead | null) => void
}

// Searchable combobox backed by a server action so we don't load every lead
// upfront. Exposes the selected id via a hidden input named `name` so the
// existing <form> + FormData flow keeps working unchanged.
export default function LeadCombobox({ name, orgSlug, defaultLead, placeholder = 'Selecionar lead...', onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Lead | null>(defaultLead || null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lead[]>(defaultLead ? [defaultLead] : [])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search: cmdk does its own client-side filtering, but we still
  // want to fetch a focused result set from the server when the user types.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const data = await searchLeads(orgSlug, query)
      setResults(data)
      setLoading(false)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, orgSlug])

  return (
    <>
      <input type="hidden" name={name} value={selected?.id || ''} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? selected.name : placeholder}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected && (
                <X
                  className="w-4 h-4 opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(null)
                    onChange?.(null)
                  }}
                />
              )}
              <ChevronsUpDown className="w-4 h-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && <div className="p-3 text-sm text-muted-foreground">Buscando...</div>}
              {!loading && <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>}
              <CommandGroup>
                {results.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    value={lead.id}
                    onSelect={() => {
                      setSelected(lead)
                      setOpen(false)
                      onChange?.(lead)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected?.id === lead.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{lead.name}</span>
                      {(lead.email || lead.phone) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {lead.email || lead.phone}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
