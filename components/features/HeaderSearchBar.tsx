'use client'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openCommandPalette } from './CommandPalette'

/** Barra de pesquisa global do header desktop — visual de input, mas abre o
 *  mesmo command palette (⌘K) já usado no resto do app, incluindo no botão
 *  "Consultar" da barra inferior mobile. Mesma busca universal nos dois
 *  lugares (lead, cliente, módulo ou ação) — só muda a superfície visual. */
export function HeaderSearchBar() {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform))
    }
  }, [])

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Pesquisar qualquer coisa — lead, cliente, módulo ou ação"
      className="hidden md:flex items-center gap-2 h-10 w-full max-w-[480px] px-3.5 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground text-[13.5px] transition-colors"
    >
      <Search className="w-4 h-4 shrink-0" />
      <span className="truncate">Pesquisar qualquer coisa...</span>
      <kbd className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground/10 shrink-0">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  )
}
