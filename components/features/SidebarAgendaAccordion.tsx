'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, CalendarDays, CheckSquare, Calendar, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'

type SubItem = { seg: 'tarefas' | 'eventos' | 'projetos'; label: string; icon: typeof CheckSquare }

const SUB_ITEMS: SubItem[] = [
  { seg: 'tarefas', label: 'Tarefas', icon: CheckSquare },
  { seg: 'eventos', label: 'Eventos', icon: Calendar },
  { seg: 'projetos', label: 'Projetos', icon: FolderKanban },
]

/** Item "Agenda" da sidebar (issue #14) — módulo único expansível reunindo
 *  Tarefas, Eventos e Projetos, mesmo padrão de acordeão de
 *  SidebarEmbarquesAccordion.tsx. Cada sub-item só aparece se a permissão
 *  correspondente (tasks/events/projects) permitir. Tarefas é só lista;
 *  Eventos tem a timeline estilo Google Agenda (mês/semana/dia) — as duas
 *  bases de dados/UIs são isoladas por pedido explícito (set/2026). */
export default function SidebarAgendaAccordion({
  base, showTasks, showEvents, showProjects, overdueCount,
}: {
  base: string
  showTasks: boolean
  showEvents: boolean
  showProjects: boolean
  overdueCount: number | null
}) {
  const pathname = usePathname()
  const agendaBase = `${base}/agenda`
  const withinAgenda = pathname === agendaBase || pathname?.startsWith(agendaBase + '/')
  const [open, setOpen] = useState(withinAgenda)

  useEffect(() => { if (withinAgenda) setOpen(true) }, [withinAgenda])

  const activeSeg = withinAgenda ? (pathname ?? '').slice(agendaBase.length + 1).split('/')[0] : null

  const items = SUB_ITEMS.filter(item =>
    item.seg === 'tarefas' ? showTasks : item.seg === 'eventos' ? showEvents : showProjects
  )
  if (items.length === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          withinAgenda ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Agenda</span>
          {!!overdueCount && overdueCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1.5 py-0 leading-none">
              {overdueCount}
            </Badge>
          )}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map(item => {
            const href = `${agendaBase}/${item.seg}`
            const isActive = activeSeg === item.seg
            const Icon = item.icon
            return (
              <Link
                key={item.seg}
                href={href}
                className={cn(
                  'flex items-center gap-2 mx-1 pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg transition-colors duration-100',
                  isActive
                    ? 'text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
