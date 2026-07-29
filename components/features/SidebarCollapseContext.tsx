'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext<{ collapsed: boolean; toggle: () => void } | null>(null)

/**
 * Estado de colapso da sidebar, compartilhado entre o botão (agora na barra
 * superior) e o <aside> em si (que precisa saber a largura). Persistido em
 * localStorage, igual ao comportamento anterior.
 */
export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

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

  return <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>
}

export function useSidebarCollapse() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider')
  return ctx
}
