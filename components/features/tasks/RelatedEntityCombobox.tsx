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
import { searchRelatedEntities } from '@/actions/tasks'

export type RelatedOption = { id: string; label: string }

interface Props {
  orgSlug: string
  entityType: string
  defaultValue?: RelatedOption | null
  placeholder?: string
  onChange?: (option: RelatedOption | null) => void
}

/** Combobox genérico usado pelo bloco "Relacionado a" — mesma estrutura de
 *  LeadCombobox.tsx (Command/Popover, busca com debounce via server action),
 *  só que parametrizado por `entityType` em vez de fixo em leads. */
export default function RelatedEntityCombobox({ orgSlug, entityType, defaultValue, placeholder = 'Selecionar...', onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<RelatedOption | null>(defaultValue || null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RelatedOption[]>(defaultValue ? [defaultValue] : [])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trocar de tipo limpa a seleção anterior (o registro pertence ao tipo antigo).
  useEffect(() => {
    setSelected(defaultValue || null)
    setResults(defaultValue ? [defaultValue] : [])
    setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const data = await searchRelatedEntities(orgSlug, entityType, query)
      setResults(data)
      setLoading(false)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, orgSlug, entityType])

  return (
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
            {selected ? selected.label : placeholder}
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
            placeholder="Buscar..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && <div className="p-3 text-sm text-muted-foreground">Buscando...</div>}
            {!loading && <CommandEmpty>Nenhum registro encontrado.</CommandEmpty>}
            <CommandGroup>
              {results.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => {
                    setSelected(opt)
                    setOpen(false)
                    onChange?.(opt)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected?.id === opt.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
