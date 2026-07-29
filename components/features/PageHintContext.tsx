'use client'

import { createContext, useContext, useState } from 'react'

const Ctx = createContext<{ hint: string | null; setHint: (h: string | null) => void } | null>(null)

/**
 * Permite que o PageHeader de cada página "empurre" seu texto de ajuda pro
 * ícone (!) que mora na barra superior, ao lado do nome da página — em vez
 * de renderizar o próprio ícone lá embaixo, ocupando mais uma linha.
 */
export function PageHintProvider({ children }: { children: React.ReactNode }) {
  const [hint, setHint] = useState<string | null>(null)
  return <Ctx.Provider value={{ hint, setHint }}>{children}</Ctx.Provider>
}

export function usePageHint() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePageHint must be used within PageHintProvider')
  return ctx
}
