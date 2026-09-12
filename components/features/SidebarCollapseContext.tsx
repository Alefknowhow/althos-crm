'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Ctx = {
  collapsed: boolean
  toggle: () => void
  // Estado do drawer mobile ("Módulos" na barra inferior — reformulação
  // mobile, G2). Vivia só como useState local dentro de SidebarShell antes;
  // subiu pro contexto pra um gatilho externo (MobileBottomNav) poder abrir
  // o mesmo drawer sem duplicar a lista de módulos em outro componente.
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const Ctx = createContext<Ctx | null>(null)

/**
 * Estado de colapso da sidebar, compartilhado entre o botão (agora na barra
 * superior) e o <aside> em si (que precisa saber a largura). Persistido em
 * localStorage, igual ao comportamento anterior.
 */
export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('sidebar-collapsed') === '1') } catch {}
  }, [])

  function toggle() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebar-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  return <Ctx.Provider value={{ collapsed, toggle, mobileOpen, setMobileOpen }}>{children}</Ctx.Provider>
}

export function useSidebarCollapse() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider')
  return ctx
}
