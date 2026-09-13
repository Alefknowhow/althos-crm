'use client'

import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Sparkles, X } from 'lucide-react'
import type { FunnelStep } from '@/actions/social-funnels'

/** Editor de passo direto no node do canvas — fixo/IA e o texto
 *  correspondente, sem precisar fechar o fluxo e voltar pra lista. */
export default function SocialFunnelNodeEditPanel({
  step, onChange, onClose,
}: {
  step: FunnelStep
  onChange: (patch: Partial<FunnelStep>) => void
  onClose: () => void
}) {
  return (
    <div className="absolute top-3 left-3 z-10 w-72 rounded-md border bg-card shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Passo</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="inline-flex rounded-md border overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => onChange({ step_type: 'message' })}
          className={`inline-flex items-center gap-1 px-2 py-1 ${step.step_type === 'message' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          <MessageSquare className="w-3 h-3" /> Resposta fixa
        </button>
        <button
          type="button"
          onClick={() => onChange({ step_type: 'ai' })}
          className={`inline-flex items-center gap-1 px-2 py-1 ${step.step_type === 'ai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          <Sparkles className="w-3 h-3" /> Resposta manual (IA)
        </button>
      </div>

      {step.step_type === 'message' ? (
        <Textarea
          rows={3}
          className="text-xs"
          placeholder="Mensagem que será enviada neste passo…"
          value={step.message_text || ''}
          onChange={e => onChange({ message_text: e.target.value })}
        />
      ) : (
        <Textarea
          rows={3}
          className="text-xs"
          placeholder="Instruções para a IA responder neste passo…"
          value={step.ai_instructions || ''}
          onChange={e => onChange({ ai_instructions: e.target.value })}
        />
      )}
    </div>
  )
}
