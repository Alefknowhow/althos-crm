'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/ui/empty-state'
import { Sparkles, Plus, Loader2, Trash2, ArrowRight, BookOpen, Wand2, Send, User as UserIcon } from 'lucide-react'
import {
  startRoteiro, sendRoteiroMessage, listRoteiroMessages, getRoteiro, deleteRoteiro, convertRoteiroToQuotation,
  type RoteiroGeneration, type RoteiroMessage, type RoteiristaKnowledgeItem,
} from '@/actions/roteirista'
import { QuickStartDialog } from './RoteiristaQuickStartDialog'
import { KnowledgeDialog } from './RoteiristaKnowledgeDialog'

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  generating: { label: 'Gerando…', variant: 'secondary' },
  done: { label: 'Pronto', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
}

export default function RoteiristaView({
  orgSlug, initialRoteiros, initialKnowledge,
}: {
  orgSlug: string
  initialRoteiros: RoteiroGeneration[]
  initialKnowledge: RoteiristaKnowledgeItem[]
}) {
  const router = useRouter()
  const [roteiros, setRoteiros] = useState(initialRoteiros)
  const [selectedId, setSelectedId] = useState<string | null>(initialRoteiros[0]?.id ?? null)
  const [messages, setMessages] = useState<RoteiroMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [quickStartOpen, setQuickStartOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  const [, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  const selected = roteiros.find(r => r.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    setLoadingMessages(true)
    startTransition(async () => {
      const msgs = await listRoteiroMessages(orgSlug, selectedId)
      setMessages(msgs)
      setLoadingMessages(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function pushOrUpdateRoteiro(id: string) {
    const row = await getRoteiro(orgSlug, id)
    if (!row) return
    setRoteiros(prev => {
      const exists = prev.some(r => r.id === id)
      return exists ? prev.map(r => (r.id === id ? row : r)) : [row, ...prev]
    })
  }

  async function handleNewConversation() {
    const res = await startRoteiro(orgSlug, {})
    if (!res.ok) { toast.error(res.error); return }
    await pushOrUpdateRoteiro(res.id)
    setSelectedId(res.id)
    setMessages([])
  }

  async function handleSend(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setSending(true)

    let targetId = selectedId
    try {
      if (!targetId) {
        const res = await startRoteiro(orgSlug, { firstMessage: message })
        if (!res.ok) { toast.error(res.error); setSending(false); return }
        targetId = res.id
        setSelectedId(targetId)
        await pushOrUpdateRoteiro(targetId)
        const msgs = await listRoteiroMessages(orgSlug, targetId)
        setMessages(msgs)
      } else {
        setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() }])
        const res = await sendRoteiroMessage(orgSlug, targetId, message)
        if (!res.ok) { toast.error(res.error); setSending(false); return }
        await pushOrUpdateRoteiro(targetId)
        const msgs = await listRoteiroMessages(orgSlug, targetId)
        setMessages(msgs)
      }
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleSend(input)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conversa?')) return
    const res = await deleteRoteiro(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    setRoteiros(prev => prev.filter(r => r.id !== id))
    if (selectedId === id) { setSelectedId(null); setMessages([]) }
    toast.success('Conversa excluída')
  }

  async function handleConvert(id: string) {
    setConverting(true)
    const res = await convertRoteiroToQuotation(orgSlug, id)
    setConverting(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Cotação criada a partir do roteiro')
    router.push(`/app/${orgSlug}/cotacoes/${res.quotationId}`)
  }

  return (
    <div className="flex flex-1 min-h-0 gap-4">
      <div className="w-full md:w-[300px] shrink-0 flex flex-col border rounded-none bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={handleNewConversation}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova conversa
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickStartOpen(true)} title="Começar com formulário">
            <Wand2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setKnowledgeOpen(true)} title="Base de conhecimento">
            <BookOpen className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {roteiros.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa ainda.</div>
          ) : (
            roteiros.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left p-3 transition-colors ${selectedId === r.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm truncate">{r.title}</span>
                  <Badge variant={STATUS_LABEL[r.status]?.variant ?? 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                    {STATUS_LABEL[r.status]?.label ?? r.status}
                  </Badge>
                </div>
                {r.converted_quotation_id && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1">Virou cotação</Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 border rounded-none bg-card flex flex-col">
        {!selected && !sending ? (
          <div className="flex-1 flex flex-col">
            <EmptyState
              icon={Sparkles}
              title="Travel Planner"
              description="Digite abaixo pra começar uma conversa, ou use o formulário-atalho pra estruturar sua primeira pergunta."
            />
            <form onSubmit={handleSubmit} className="border-t bg-card p-3 flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ex.: Quero um roteiro de 5 dias em Fernando de Noronha, saindo de SP…"
                disabled={sending}
                className="flex-1 h-10 text-sm"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} className="h-10 w-10 shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start justify-between gap-3 z-10">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{selected?.title || 'Nova conversa'}</h2>
              </div>
              {selected && (
                <div className="shrink-0 flex items-center gap-1.5">
                  {selected.status === 'done' && !selected.converted_quotation_id && (
                    <Button size="sm" disabled={converting} onClick={() => handleConvert(selected.id)}>
                      {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ArrowRight className="w-3.5 h-3.5 mr-1.5" />}
                      Transformar em cotação
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-primary/10 text-primary'}`}>
                      {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>
                    {m.role === 'user' ? (
                      <div className="max-w-[80%] rounded-none px-3.5 py-2 text-sm bg-primary text-primary-foreground inline-block whitespace-pre-wrap">
                        {m.content}
                      </div>
                    ) : (
                      <div className="max-w-[88%] flex-1 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: m.content }} />
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-muted rounded-none px-3.5 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-muted-foreground text-xs">pesquisando e escrevendo…</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t bg-card p-3 flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Continue a conversa…"
                disabled={sending}
                className="flex-1 h-10 text-sm"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} className="h-10 w-10 shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        )}
      </div>

      <QuickStartDialog
        orgSlug={orgSlug}
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
        onCreated={async id => { setQuickStartOpen(false); await pushOrUpdateRoteiro(id); setSelectedId(id) }}
      />
      <KnowledgeDialog
        orgSlug={orgSlug}
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
        initialItems={initialKnowledge}
      />
    </div>
  )
}
