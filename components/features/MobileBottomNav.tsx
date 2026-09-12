'use client'

/**
 * Barra de navegação inferior mobile — reformulação mobile G2. Substitui o
 * hamburger fixo (que colidia com banners) por 4 destinos estáveis: Resumo,
 * Consultar, Assistente e Módulos. Assistente só aparece se o usuário tem
 * permissão de Copiloto (canUseCopilot) — sem permissão, vira 3 destinos em
 * vez de um botão inoperante (regra explícita do documento de reformulação).
 *
 * "Módulos" reabre o MESMO drawer que a sidebar mobile já usa (via
 * SidebarCollapseContext.mobileOpen) — não duplica a lista de módulos.
 * "Consultar" abre o mesmo CommandPalette do desktop (mesma fonte de busca).
 * "Assistente" abre o mesmo CopilotProvider global (mesmo agente de sempre).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Search, Sparkles, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarCollapse } from './SidebarCollapseContext'
import { useCopilot } from './CopilotProvider'
import { openCommandPalette } from './CommandPalette'

export function MobileBottomNav({ orgSlug, canUseCopilot }: { orgSlug: string; canUseCopilot: boolean }) {
  const pathname = usePathname()
  const { setMobileOpen } = useSidebarCollapse()
  // Hook sempre chamado (regra dos hooks) — o provider sempre envolve o
  // layout (ver app/app/[orgSlug]/layout.tsx), então isto nunca lança. A
  // decisão de MOSTRAR o item Assistente é feita depois, via canUseCopilot.
  const copilotCtx = useCopilot()
  const copilot = canUseCopilot ? copilotCtx : null

  const isResumo = pathname === `/app/${orgSlug}`

  const items: { key: string; label: string; icon: typeof LayoutGrid; active: boolean; onClick?: () => void; href?: string }[] = [
    { key: 'resumo', label: 'Resumo', icon: LayoutGrid, active: isResumo, href: `/app/${orgSlug}` },
    { key: 'consultar', label: 'Consultar', icon: Search, active: false, onClick: openCommandPalette },
  ]
  if (copilot) {
    items.push({ key: 'assistente', label: 'Assistente', icon: Sparkles, active: copilot.open, onClick: () => copilot.setOpen(!copilot.open) })
  }
  items.push({ key: 'modulos', label: 'Módulos', icon: Menu, active: false, onClick: () => setMobileOpen(true) })

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-20 pb-[env(safe-area-inset-bottom)] bg-background border-t border-border flex items-stretch print:hidden"
      aria-label="Navegação principal"
    >
      {items.map(item => {
        const Icon = item.icon
        const content = (
          <>
            <Icon className={cn('w-6 h-6', item.active ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-xs font-medium', item.active ? 'text-primary' : 'text-muted-foreground')}>{item.label}</span>
          </>
        )
        const className = 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px]'
        return item.href ? (
          <Link key={item.key} href={item.href} className={className} aria-current={item.active ? 'page' : undefined}>
            {content}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={item.onClick} className={className} aria-pressed={item.active}>
            {content}
          </button>
        )
      })}
    </nav>
  )
}
