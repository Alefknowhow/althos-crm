'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'

interface CatalogFiltersProps {
  orgSlug: string
  categories: string[]
}

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

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 py-2">
      <div className="relative flex-1 w-full md:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome, SKU ou categoria..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-sm w-full"
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px] h-9">
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

        <div className="flex items-center space-x-2">
          <Switch 
            id="active-filter" 
            checked={isActive} 
            onCheckedChange={setIsActive}
          />
          <Label htmlFor="active-filter" className="text-sm font-medium cursor-pointer whitespace-nowrap">
            Apenas ativos
          </Label>
        </div>
      </div>
    </div>
  )
}
