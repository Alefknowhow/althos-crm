'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Send, Loader2, FileText } from 'lucide-react'
import {
  generateFormWithAi, createFormFromAiSchema, type FormAiChatTurn, type FormAiSchema,
} from '@/actions/forms-ai'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * "Criar com IA" — chat pontual (sem persistência: fecha o dialog, perde a
 * conversa) que monta o schema de um formulário conversando em português.
 * Ao ficar pronto, mostra um preview simples dos campos propostos e um
 * botão pra criar de verdade — que cai no editor normal (FormBuilder) pra
 * ajustes finos, igual o fluxo do "+ Novo Formulário".
 */
export default function CreateFormWithAiDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [proposal, setProposal] = useState<{ name: string; schema: FormAiSchema } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  function reset() {
    setMessages([])
    setInput('')
    setProposal(null)
  }

  async function handleSend(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setProposal(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setSending(true)

    const history: FormAiChatTurn[] = nextMessages
    const res = await generateFormWithAi(orgSlug, history)
    setSending(false)

    if (!res.ok) {
      toast.error(res.error)
      setMessages(prev => prev.slice(0, -1))
      setInput(message)
      return
    }

    setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    if (res.ready && res.schema && res.name) {
      setProposal({ name: res.name, schema: res.schema })
    }
  }

  async function handleCreate() {
    if (!proposal) return
    setCreating(true)
    const res = await createFormFromAiSchema(orgSlug, proposal.name, proposal.schema)
    setCreating(false)
    if (!res.ok || !res.form) { toast.error(res.ok ? 'Erro ao criar formulário' : res.error); return }
    toast.success('Formulário criado')
    setOpen(false)
    reset()
    router.push(`/app/${orgSlug}/forms/${res.form.id}/edit`)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="w-4 h-4" />
        Criar com IA
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-lg h-[70vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Criar formulário com IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Descreva o formulário que você precisa — por exemplo: &quot;formulário de captação pra viagem, com nome, telefone, destino desejado e orçamento&quot;.
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

            {proposal && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileText className="w-3.5 h-3.5" />
                  {proposal.name}
                </div>
                <ul className="space-y-0.5">
                  {proposal.schema.fields.map(f => (
                    <li key={f.id} className="text-xs text-muted-foreground truncate">
                      • {f.label}{f.required ? ' *' : ''}
                    </li>
                  ))}
                </ul>
                <Button size="sm" onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar este formulário'}
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
              placeholder="Descreva o formulário..."
              className="flex-1 resize-none min-h-[40px] max-h-32"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
