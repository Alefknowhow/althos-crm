'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Sparkles, Plus, Loader2, Trash2, ArrowRight, BookOpen, Wand2, Send, User as UserIcon } from 'lucide-react'
import {
  startRoteiro, sendRoteiroMessage, listRoteiroMessages, getRoteiro, deleteRoteiro, convertRoteiroToQuotation,
  addRoteiristaKnowledge, deleteRoteiristaKnowledge,
  type RoteiroGeneration, type RoteiroMessage, type RoteiristaKnowledgeItem,
} from '@/actions/roteirista'
import type { RoteiroMode, RoteiroTurno } from '@/lib/ai/roteirista'

const TURNO_OPTIONS: { id: RoteiroTurno; label: string }[] = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' },
]

const MODE_OPTIONS: { id: RoteiroMode; label: string }[] = [
  { id: 'completo', label: 'Roteiro completo' },
  { id: 'hoteis', label: 'Só hotéis' },
  { id: 'voos', label: 'Só voos' },
]

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

function QuickStartDialog({
  orgSlug, open, onOpenChange, onCreated,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (id: string) => void
}) {
  const [mode, setMode] = useState<RoteiroMode>('completo')
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [periodoFlexivel, setPeriodoFlexivel] = useState(false)
  const [dataIda, setDataIda] = useState('')
  const [dataVolta, setDataVolta] = useState('')
  const [turnoIda, setTurnoIda] = useState<RoteiroTurno | ''>('')
  const [turnoVolta, setTurnoVolta] = useState<RoteiroTurno | ''>('')
  const [mesReferencia, setMesReferencia] = useState('')
  const [paxAdults, setPaxAdults] = useState(2)
  const [paxChildren, setPaxChildren] = useState(0)
  const [nivelConforto, setNivelConforto] = useState<string>('padrao')
  const [orcamento, setOrcamento] = useState('')
  const [interesses, setInteresses] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [generating, setGenerating] = useState(false)

  function reset() {
    setMode('completo'); setOrigem(''); setDestino(''); setPeriodoFlexivel(false)
    setDataIda(''); setDataVolta(''); setTurnoIda(''); setTurnoVolta(''); setMesReferencia('')
    setPaxAdults(2); setPaxChildren(0); setNivelConforto('padrao')
    setOrcamento(''); setInteresses(''); setObservacoes('')
  }

  async function handleStart() {
    if (!destino.trim()) { toast.error('Informe o destino.'); return }
    setGenerating(true)
    const res = await startRoteiro(orgSlug, {
      quickStart: {
        mode,
        origem: origem.trim() || null,
        destino,
        dataIda: periodoFlexivel ? null : (dataIda || null),
        dataVolta: periodoFlexivel ? null : (dataVolta || null),
        turnoIda: periodoFlexivel ? null : (turnoIda || null),
        turnoVolta: periodoFlexivel ? null : (turnoVolta || null),
        periodoFlexivel,
        mesReferencia: periodoFlexivel ? (mesReferencia || null) : null,
        paxAdults,
        paxChildren,
        nivelConforto,
        orcamentoCents: orcamento ? Math.round(Number(orcamento.replace(',', '.')) * 100) : null,
        interesses: interesses.trim() || null,
        observacoes: observacoes.trim() || null,
      },
    })
    setGenerating(false)
    if (!res.ok) { toast.error(res.error); return }
    reset()
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> Começar com formulário</DialogTitle>
          <DialogDescription>Atalho opcional — monta a primeira mensagem da conversa pra você. Você pode continuar digitando livremente depois.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-lg border p-2.5 text-xs ${mode === m.id ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Origem</Label>
              <Input value={origem} onChange={e => setOrigem(e.target.value)} placeholder="Ex.: São Paulo, SP" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destino <span className="text-destructive">*</span></Label>
              <Input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex.: Porto de Galinhas, PE" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={periodoFlexivel} onCheckedChange={v => setPeriodoFlexivel(v === true)} />
            <span>Período flexível — buscar a data mais barata</span>
          </label>

          {periodoFlexivel ? (
            <div className="space-y-1">
              <Label className="text-xs">Mês/período de referência</Label>
              <Input value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} placeholder="Ex.: julho de 2026, ou 'próximos 3 meses'" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Ida</Label>
                <Input type="date" value={dataIda} onChange={e => setDataIda(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Turno da ida</Label>
                <Select value={turnoIda} onValueChange={v => setTurnoIda(v as RoteiroTurno)}>
                  <SelectTrigger><SelectValue placeholder="Sem preferência" /></SelectTrigger>
                  <SelectContent>
                    {TURNO_OPTIONS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Volta</Label>
                <Input type="date" value={dataVolta} onChange={e => setDataVolta(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Turno da volta</Label>
                <Select value={turnoVolta} onValueChange={v => setTurnoVolta(v as RoteiroTurno)}>
                  <SelectTrigger><SelectValue placeholder="Sem preferência" /></SelectTrigger>
                  <SelectContent>
                    {TURNO_OPTIONS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Adultos</Label>
              <Input type="number" min={1} value={paxAdults} onChange={e => setPaxAdults(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Crianças</Label>
              <Input type="number" min={0} value={paxChildren} onChange={e => setPaxChildren(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nível de conforto</Label>
              <Select value={nivelConforto} onValueChange={setNivelConforto}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="economico">Econômico</SelectItem>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="luxo">Luxo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Orçamento aprox. (R$)</Label>
              <Input value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="Ex.: 5000" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Interesses</Label>
            <Input value={interesses} onChange={e => setInteresses(e.target.value)} placeholder="Ex.: praia, gastronomia, passeios de barco" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Qualquer detalhe adicional pra IA considerar" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={generating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={generating} onClick={handleStart}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {generating ? 'Gerando…' : 'Iniciar conversa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KnowledgeDialog({
  orgSlug, open, onOpenChange, initialItems,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  initialItems: RoteiristaKnowledgeItem[]
}) {
  const [items, setItems] = useState(initialItems)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    const res = await addRoteiristaKnowledge(orgSlug, text)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setItems(prev => [{ id: crypto.randomUUID(), content: text.trim(), is_active: true, created_at: new Date().toISOString() }, ...prev])
    setText('')
    toast.success('Conhecimento adicionado')
  }

  async function handleDelete(id: string) {
    const res = await deleteRoteiristaKnowledge(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Base de conhecimento</DialogTitle>
          <DialogDescription>
            Fatos que a IA considera ao conversar — ex.: &quot;Grand Palladium tem gratuidade para até 2 CHD de até 17 anos por quarto, acompanhado de adultos pagantes.&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Escreva um conhecimento e clique em Adicionar…" />
          <div className="flex justify-end">
            <Button size="sm" disabled={saving || !text.trim()} onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum conhecimento cadastrado ainda.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                <p className="flex-1">{item.content}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
