'use client'

/**
 * Estado compartilhado (aberto/fechado) do Copiloto IA entre o botão da
 * header (CopilotTriggerButton) e o painel (CopilotDock) — os dois vivem em
 * pontos diferentes da árvore em app/app/[orgSlug]/layout.tsx (header vs.
 * fora do <main>), então precisam de um Context em vez de estado local.
 */

import { createContext, useContext, useState } from 'react'

type CopilotContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const CopilotContext = createContext<CopilotContextValue | null>(null)

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <CopilotContext.Provider value={{ open, setOpen }}>{children}</CopilotContext.Provider>
}

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext)
  if (!ctx) throw new Error('useCopilot must be used within a CopilotProvider')
  return ctx
}
