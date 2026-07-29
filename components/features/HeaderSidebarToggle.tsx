'use client'

import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSidebarCollapse } from './SidebarCollapseContext'
import { getPageTitle } from '@/lib/route-titles'

/**
 * Botão de colapsar/expandir a sidebar + nome da página atual, ambos na
 * primeira linha do conteúdo — ganha uma linha inteira de espaço vertical
 * que antes era ocupada só pelo <h1> de cada página (PageHeader).
 */
export function HeaderSidebarToggle({ orgSlug }: { orgSlug: string }) {
  const { collapsed, toggle } = useSidebarCollapse()
  const pathname = usePathname()
  const title = getPageTitle(pathname, orgSlug)

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="hidden md:inline-flex shrink-0 w-8 h-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {collapsed
          ? <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
          : <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />}
      </button>
      {title && (
        <h1 className="text-sm font-semibold tracking-apple-snug truncate">{title}</h1>
      )}
    </div>
  )
}
