'use client'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openCommandPalette } from './CommandPalette'

/** Barra de pesquisa global do header desktop — visual de input, mas abre o
 *  mesmo command palette (⌘K) já usado no resto do app. */
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
      aria-label="Buscar módulos, contatos ou ir para..."
      className="hidden md:flex items-center gap-2 h-9 w-[280px] lg:w-[340px] px-3 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground text-sm transition-colors shrink-0"
    >
      <Search className="w-4 h-4 shrink-0" />
      <span className="truncate">Buscar módulos...</span>
      <kbd className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded bg-background border border-border shrink-0">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  )
}
