'use client'

import { Sparkles } from 'lucide-react'
import { useCopilot } from '@/components/features/CopilotProvider'

/**
 * Botão discreto de abertura do Copiloto IA na header — usa o mesmo
 * tratamento visual (ícone + fundo tintado na cor primária) do avatar do
 * copiloto dentro do próprio painel, pra ficar reconhecível de relance sem
 * ser confundido com os demais ícones da header (que são todos neutros/
 * ghost — notificações, tema, suporte).
 */
export function CopilotTriggerButton() {
  const { open, setOpen } = useCopilot()

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      title="Copiloto IA"
      aria-label="Abrir copiloto IA"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
    >
      <Sparkles className="w-4 h-4" />
    </button>
  )
}
