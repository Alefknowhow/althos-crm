'use client'

import { LogoMark } from '@/components/brand/Logo'
import { useCopilot } from '@/components/features/CopilotProvider'

/**
 * Botão discreto de abertura do Althos AI na header — usa o logo da marca
 * pra ficar reconhecível de relance sem ser confundido com os demais ícones
 * da header (que são todos neutros/ghost — notificações, tema, suporte).
 */
export function CopilotTriggerButton() {
  const { open, setOpen } = useCopilot()

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      title="Althos AI"
      aria-label="Abrir Althos AI"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-primary/10 transition-colors"
    >
      <LogoMark v2 className="h-6 w-6" />
    </button>
  )
}
