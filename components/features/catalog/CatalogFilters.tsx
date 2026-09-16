'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, SlidersHorizontal } from 'lucide-react'

interface CatalogFiltersProps {
  orgSlug: string
  categories: string[]
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export default function CatalogFilters({ orgSlug, categories }: CatalogFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [isActive, setIsActive] = useState(searchParams.get('active') !== 'false')

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (search) params.set('q', search)
      else params.delete('q')

      if (category && category !== 'all') params.set('category', category)
      else params.delete('category')

      if (!isActive) params.set('active', 'false')
      else params.delete('active')

      // Reset page when filtering
      params.delete('page')

      const newPath = `/app/${orgSlug}/catalogo?${params.toString()}`
      if (newPath !== `/app/${orgSlug}/catalogo?${searchParams.toString()}`) {
        router.push(newPath)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category, isActive, router, orgSlug, searchParams])

  const hasActiveFilters = category !== 'all' || !isActive
  function clearFilters() { setCategory('all'); setIsActive(true) }

  return (
    <div className="flex items-center gap-2 py-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)] shrink-0',
              FOCUS_RING,
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.filter(cat => cat && cat.trim() !== '').map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active-filter" className="text-xs cursor-pointer">Apenas ativos</Label>
            <Switch
              id="active-filter"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
