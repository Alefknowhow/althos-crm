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
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Settings, Star } from 'lucide-react'

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
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card text-[12.5px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.05)]">
        {current?.name || 'Pipeline'}
        <Link
          href={`/app/${orgSlug}/configuracoes/pipelines`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center"
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
        <button
          type="button"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card text-[12.5px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-muted transition-colors"
        >
          {current?.name || 'Pipeline'}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
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
