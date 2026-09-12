'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { MobileBottomSheet } from './MobileBottomSheet'
import { cn } from '@/lib/utils'

export type MobileSection = { key: string; label: string; badge?: number }

/**
 * Seletor de seção M3 (spec mobile G3, 3.4): substitui abas que não cabem
 * (4+ categorias ou nomes longos — ex.: Configurações com 9 destinos,
 * ClientDetailShell com 7 seções). A seção atual sempre aparece escrita por
 * extenso no gatilho, nunca truncada/abreviada.
 *
 * Duas/três categorias curtas continuam como abas normais — este
 * componente é só pro caso de excesso, não substitui toda navegação por
 * abas do app.
 */
export function MobileSectionPicker({
  sections,
  activeKey,
  onChange,
}: {
  sections: MobileSection[]
  activeKey: string
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = sections.find(s => s.key === activeKey) ?? sections[0]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-12 px-1 text-base font-medium text-m3-on-surface"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{active?.label}</span>
        <ChevronDown className="w-5 h-5 text-m3-on-surface-variant" />
      </button>

      <MobileBottomSheet open={open} onOpenChange={setOpen} title="Escolher seção">
        <div className="space-y-1" role="listbox">
          {sections.map(s => (
            <button
              key={s.key}
              type="button"
              role="option"
              aria-selected={s.key === activeKey}
              onClick={() => { onChange(s.key); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between min-h-[48px] px-3 rounded-mcard text-left text-base',
                s.key === activeKey ? 'bg-m3-primary-container text-m3-on-primary-container font-medium' : 'text-m3-on-surface hover:bg-m3-surface-container',
              )}
            >
              <span>{s.label}</span>
              {typeof s.badge === 'number' && s.badge > 0 && (
                <span className="text-sm text-m3-on-surface-variant">{s.badge}</span>
              )}
            </button>
          ))}
        </div>
      </MobileBottomSheet>
    </>
  )
}
