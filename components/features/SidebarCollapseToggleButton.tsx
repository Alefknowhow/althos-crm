'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSidebarCollapse } from './SidebarCollapseContext'

/** Botão de colapsar/expandir a sidebar, ao lado do logo "AlthosCRM". */
export default function SidebarCollapseToggleButton() {
  const { collapsed, toggle } = useSidebarCollapse()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
    >
      {collapsed
        ? <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
        : <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />}
    </button>
  )
}
