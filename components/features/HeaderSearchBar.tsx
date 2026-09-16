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
      className="hidden md:flex items-center gap-2 h-[34px] w-[260px] lg:w-[300px] px-2.5 rounded-lg bg-muted/70 hover:bg-muted text-muted-foreground text-[12.5px] transition-colors shrink-0"
    >
      <Search className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">Pesquisar qualquer coisa...</span>
      <kbd className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded bg-foreground/10 shrink-0">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  )
}
