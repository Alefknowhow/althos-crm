'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Send, Loader2, Zap } from 'lucide-react'
import {
  generateAutomationWithAi, type AutomationAiChatTurn, type AutomationAiPlan,
} from '@/actions/automations-ai'
import { createAutomation } from '@/actions/automations'
import { triggerMeta } from '@/lib/automations/trigger-meta'
import { stepMeta } from './AutomationFlowMeta'
import { VoiceInputButton } from '@/components/features/ai/VoiceInputButton'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * "Criar com IA" — chat pontual (sem persistência) que monta gatilho +
 * passos + ramificações conversando em português, mesmo padrão de
 * CreateFormWithAiDialog.tsx. Ao ficar pronto, mostra um preview e cria a
 * automação de verdade, abrindo no canvas normal pra ajustes finos.
 */
export default function CreateAutomationWithAiDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plan, setPlan] = useState<AutomationAiPlan | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  function reset() {
    setMessages([])
    setInput('')
    setPlan(null)
  }

  async function handleSend(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setPlan(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setSending(true)

    const history: AutomationAiChatTurn[] = nextMessages
    const res = await generateAutomationWithAi(orgSlug, history)
    setSending(false)

    if (!res.ok) {
      toast.error(res.error)
      setMessages(prev => prev.slice(0, -1))
      setInput(message)
      return
    }

    setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    if (res.ready && res.plan) setPlan(res.plan)
  }

  async function handleCreate() {
    if (!plan) return
    setCreating(true)
    try {
      const auto = await createAutomation(orgSlug, plan)
      if (!auto?.id) { toast.error('Não foi possível criar a automação'); return }
      toast.success('Automação criada')
      setOpen(false)
      reset()
      router.push(`/app/${orgSlug}/automacoes/${auto.id}`)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar automação')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="w-4 h-4 mr-1.5" />
        Criar com IA
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-lg h-[70vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Criar automação com IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Descreva a automação que você precisa — por exemplo: &quot;quando receber DM no Instagram com a palavra
                orçamento, manda uma mensagem com 2 botões (Viagem nacional / Viagem internacional) e, conforme o
                botão clicado, move o lead pro estágio certo&quot;.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3.5 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando...
                </div>
              </div>
            )}

            {plan && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  {plan.name}
                </div>
                <p className="text-xs text-muted-foreground">Gatilho: {triggerMeta(plan.trigger_type).label}</p>
                <ul className="space-y-0.5">
                  {plan.steps.map(s => (
                    <li key={s.id} className="text-xs text-muted-foreground truncate">
                      • {stepMeta(s.type).label}
                    </li>
                  ))}
                </ul>
                <Button size="sm" onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar esta automação'}
                </Button>
              </div>
            )}
            <div ref={endRef} className="h-1" />
          </div>

          <form
            onSubmit={e => { e.preventDefault(); handleSend(input) }}
            className="px-5 py-3 border-t border-border flex gap-2 items-end shrink-0"
          >
            <Textarea
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input) } }}
              placeholder="Descreva a automação..."
              className="flex-1 resize-none min-h-[40px] max-h-32"
              disabled={sending}
            />
            <VoiceInputButton orgSlug={orgSlug} onTranscribed={text => setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))} disabled={sending} />
            <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
