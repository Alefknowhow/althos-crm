'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Kanban } from 'lucide-react'

type Pipeline = { id: string; name: string }

export default function PipelineFilter({ pipelines }: { pipelines: Pipeline[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Hide the filter when there's only one pipeline — no meaningful choice.
  if (pipelines.length <= 1) return null

  const current = searchParams.get('pipeline_id') || 'all'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('pipeline_id')
    else params.set('pipeline_id', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px] h-9">
        <Kanban className="w-4 h-4 mr-1 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os pipelines</SelectItem>
        {pipelines.map(p => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
