'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Cache client-side compartilhado entre componentes — resolve o problema de
 * cada widget refazer fetch do zero ao trocar de aba/remontar (ver auditoria
 * de escalabilidade, docs/audit/). `useState(() => new QueryClient())` evita
 * recriar o client a cada render deste provider.
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — dado "fresco o suficiente" sem martelar o banco a cada troca de aba
        refetchOnWindowFocus: false,
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
