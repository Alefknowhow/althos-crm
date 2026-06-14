'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User } from 'lucide-react'

type Seller = { id: string; name: string }

export default function SellerFilter({ sellers }: { sellers: Seller[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Sem vendedores cadastrados (ou só um) não há escolha útil a fazer.
  if (sellers.length <= 1) return null

  const current = searchParams.get('seller_id') || 'all'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('seller_id')
    else params.set('seller_id', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px] h-9">
        <User className="w-4 h-4 mr-1 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os vendedores</SelectItem>
        {sellers.map(s => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
