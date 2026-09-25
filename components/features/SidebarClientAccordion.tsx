'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDown, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUB_ITEMS = [
  { key: 'visao-geral', label: 'Visão geral' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'estrategia', label: 'Estratégia' },
  { key: 'campanhas', label: 'Estrutura de Campanhas' },
  { key: 'criativos', label: 'Criativos' },
  { key: 'biblioteca', label: 'Biblioteca' },
  { key: 'conversoes', label: 'Conversões' },
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'projetos', label: 'Projetos' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'contrato', label: 'Contrato & Financeiro' },
] as const

/** Item "Clientes" da sidebar (Agências de Tráfego) — mesmo padrão de
 *  SidebarConfigAccordion: quando o usuário está dentro do workspace de UM
 *  cliente (/agencias-trafego/trafego/[id]), a linha vira um acordeão com
 *  as 9 abas desse cliente (a aba ativa vem de ?tab=, mesma query string que
 *  ClientDetailShell.tsx lê/escreve — não é estado local isolado). Fora
 *  disso (lista de clientes, ou qualquer outra tela), é só um link normal
 *  pra lista — não faz sentido oferecer sub-abas de "nenhum cliente". */
export default function SidebarClientAccordion({ base }: { base: string }) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const listBase = `${base}/agencias-trafego/trafego`

  const escaped = listBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = pathname.match(new RegExp(`^${escaped}/([^/]+)$`))
  const clientId = match ? match[1] : null
  const withinClient = !!clientId

  const [open, setOpen] = useState(withinClient)
  useEffect(() => { if (withinClient) setOpen(true) }, [withinClient])

  const activeTab = withinClient ? (searchParams.get('tab') || 'visao-geral') : null

  if (!withinClient) {
    return (
      <Link
        href={listBase}
        className="flex items-center gap-2.5 mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors duration-100"
      >
        <Target className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
        <span className="truncate">Clientes</span>
      </Link>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug bg-primary/15 text-sidebar-foreground transition-colors duration-100"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Target className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Clientes</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {SUB_ITEMS.map(item => {
            const isActive = activeTab === item.key
            return (
              <Link
                key={item.key}
                href={`${listBase}/${clientId}?tab=${item.key}`}
                className={cn(
                  'flex items-center mx-1 pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg transition-colors duration-100',
                  isActive ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
