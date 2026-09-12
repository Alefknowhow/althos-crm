'use client'

import { useState, useEffect } from 'react'
import { MobileBottomSheet } from './MobileBottomSheet'
import { MobileButton } from './MobileButton'

/**
 * Filtro em bottom sheet M3 (reformulação mobile, G3): mostra contagem de
 * filtros ativos no gatilho, Aplicar/Limpar dentro do sheet, e só propaga a
 * mudança no clique de "Aplicar" — nunca filtra a lista a cada toque, pra
 * não recarregar a tela inteira enquanto o usuário ainda está decidindo.
 */
export function MobileFilterSheet({
  open,
  onOpenChange,
  activeCount,
  onApply,
  onClear,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeCount: number
  onApply: () => void
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <MobileBottomSheet open={open} onOpenChange={onOpenChange} title={`Filtros${activeCount > 0 ? ` (${activeCount} ativo${activeCount > 1 ? 's' : ''})` : ''}`}>
      <div className="space-y-4">
        <p className="text-base font-medium text-m3-on-surface">
          Filtros{activeCount > 0 ? ` — ${activeCount} ativo${activeCount > 1 ? 's' : ''}` : ''}
        </p>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 pt-2">
          <MobileButton variant="outlined" className="flex-1" onClick={onClear}>Limpar</MobileButton>
          <MobileButton variant="filled" className="flex-1" onClick={() => { onApply(); onOpenChange(false) }}>Aplicar</MobileButton>
        </div>
      </div>
    </MobileBottomSheet>
  )
}

/** Botão-gatilho padrão pra abrir o MobileFilterSheet, com badge de contagem. */
export function MobileFilterTrigger({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-pill border border-m3-outline-variant text-sm font-medium text-m3-on-surface"
    >
      Filtros
      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-m3-primary text-m3-on-primary text-[11px] font-semibold">
          {activeCount}
        </span>
      )}
    </button>
  )
}

/** Hook simples: mantém rascunho de filtros no sheet, só emite ao Aplicar. */
export function useDraftFilters<T extends Record<string, unknown>>(committed: T) {
  const [draft, setDraft] = useState<T>(committed)
  useEffect(() => setDraft(committed), [committed])
  return { draft, setDraft }
}
