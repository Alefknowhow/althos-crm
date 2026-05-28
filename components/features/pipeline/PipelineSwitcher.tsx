'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Plus, Settings, Star } from 'lucide-react'

type Pipeline = { id: string; name: string; is_default: boolean }

export default function PipelineSwitcher({
  orgSlug,
  pipelines,
  currentId,
}: {
  orgSlug: string
  pipelines: Pipeline[]
  currentId: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const current = pipelines.find(p => p.id === currentId)

  function switchTo(id: string) {
    router.push(`${pathname}?pipeline_id=${id}`)
  }

  if (pipelines.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{current?.name || 'Pipeline'}</h1>
        <Link
          href={`/app/${orgSlug}/configuracoes/pipelines`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Gerenciar pipelines"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-1 -ml-1 gap-2 hover:bg-muted">
          <h1 className="text-2xl font-bold">{current?.name || 'Pipeline'}</h1>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Pipelines</DropdownMenuLabel>
        {pipelines.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => switchTo(p.id)}
            className="flex items-center justify-between"
          >
            <span className={p.id === currentId ? 'font-semibold' : ''}>{p.name}</span>
            {p.is_default && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-2">
                <Star className="w-2.5 h-2.5 mr-0.5" /> padrão
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/app/${orgSlug}/configuracoes/pipelines`}>
            <Settings className="w-4 h-4 mr-2" /> Gerenciar pipelines
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
