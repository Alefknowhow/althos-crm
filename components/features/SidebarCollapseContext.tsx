'use client'

import { createContext, useContext, useState } from 'react'

type Ctx = {
  // Estado do drawer mobile ("Módulos" na barra inferior — reformulação
  // mobile, G2). Vivia só como useState local dentro de SidebarShell antes;
  // subiu pro contexto pra um gatilho externo (MobileBottomNav) poder abrir
  // o mesmo drawer sem duplicar a lista de módulos em outro componente.
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const Ctx = createContext<Ctx | null>(null)

/**
 * Sidebar desktop é fixa (sem opção de recolher) — este provider hoje só
 * carrega o estado do drawer mobile, compartilhado entre o gatilho externo
 * (MobileBottomNav) e o próprio drawer (SidebarShell).
 */
export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return <Ctx.Provider value={{ mobileOpen, setMobileOpen }}>{children}</Ctx.Provider>
}

export function useSidebarCollapse() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider')
  return ctx
}
