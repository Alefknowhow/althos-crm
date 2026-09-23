'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDown, CalendarClock, ListChecks, GanttChartSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUB_ITEMS = [
  { seg: '', label: 'Lista', icon: ListChecks },
  { seg: 'linha-do-tempo', label: 'Linha do tempo', icon: GanttChartSquare },
] as const

/** Item "Embarques" da sidebar — expansível (acordeão), mesmo padrão de
 *  SidebarVoiceAccordion.tsx: a linha inteira é o gatilho que abre/fecha a
 *  lista de sub-seções (antes uma aba Lista/Linha do tempo dentro da mesma
 *  página, agora duas rotas — a navegação entre elas acontece só pelos
 *  sub-itens daqui). Abre sozinho quando a rota atual já está dentro de
 *  /embarques. */
export default function SidebarEmbarquesAccordion({ base }: { base: string }) {
  const pathname = usePathname()
  const embarquesBase = `${base}/embarques`
  const withinEmbarques = pathname === embarquesBase || pathname?.startsWith(embarquesBase + '/')
  const [open, setOpen] = useState(withinEmbarques)

  // Segue a rota se o usuário navegar pra dentro/fora de Embarques por outro
  // caminho (ex.: link direto, botão "voltar").
  useEffect(() => { if (withinEmbarques) setOpen(true) }, [withinEmbarques])

  const activeSeg = withinEmbarques
    ? (pathname === embarquesBase ? '' : (pathname ?? '').slice(embarquesBase.length + 1).split('/')[0])
    : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          withinEmbarques ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Embarques</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {SUB_ITEMS.map(item => {
            const href = item.seg ? `${embarquesBase}/${item.seg}` : embarquesBase
            const isActive = activeSeg === item.seg
            const Icon = item.icon
            return (
              <Link
                key={item.seg || 'lista'}
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
