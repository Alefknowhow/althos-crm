'use client'

import { useState } from 'react'
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
import { Sparkles, Plus, Loader2, Trash2, ArrowRight, BookOpen, MapPin, Hotel, Plane } from 'lucide-react'
import {
  generateRoteiroAction, deleteRoteiro, convertRoteiroToQuotation,
  addRoteiristaKnowledge, deleteRoteiristaKnowledge,
  type RoteiroGeneration, type RoteiristaKnowledgeItem,
} from '@/actions/roteirista'
import type { RoteiroMode } from '@/lib/ai/roteirista'

const MODE_OPTIONS: { id: RoteiroMode; label: string; icon: typeof MapPin }[] = [
  { id: 'completo', label: 'Roteiro completo', icon: MapPin },
  { id: 'hoteis', label: 'Só hotéis', icon: Hotel },
  { id: 'voos', label: 'Só voos', icon: Plane },
]

const MODE_LABEL: Record<RoteiroMode, string> = {
  completo: 'Roteiro completo',
  hoteis: 'Só hotéis',
  voos: 'Só voos',
}

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
  const [newOpen, setNewOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [converting, setConverting] = useState(false)

  const selected = roteiros.find(r => r.id === selectedId) ?? null

  function refreshAndSelect(id?: string) {
    router.refresh()
    if (id) setSelectedId(id)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este roteiro?')) return
    const res = await deleteRoteiro(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    setRoteiros(prev => prev.filter(r => r.id !== id))
    if (selectedId === id) setSelectedId(null)
    toast.success('Roteiro excluído')
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
      <div className="w-full md:w-[340px] shrink-0 flex flex-col border rounded-none bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo roteiro
          </Button>
          <Button size="sm" variant="outline" onClick={() => setKnowledgeOpen(true)} title="Base de conhecimento">
            <BookOpen className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {roteiros.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum roteiro gerado ainda.</div>
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
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{MODE_LABEL[r.mode]}</span>
                  {r.converted_quotation_id && <Badge variant="outline" className="text-[10px] px-1 py-0">Virou cotação</Badge>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 border rounded-none bg-card overflow-y-auto">
        {!selected ? (
          <EmptyState
            icon={Sparkles}
            title="Selecione ou gere um roteiro"
            description="Preencha o formulário de um novo roteiro pra pesquisar destino, hotéis e voos com IA."
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start justify-between gap-3 z-10">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{selected.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{MODE_LABEL[selected.mode]}</p>
              </div>
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
            </div>
            <div className="p-4">
              {selected.status === 'generating' && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Pesquisando e montando o roteiro com IA…</p>
                </div>
              )}
              {selected.status === 'error' && (
                <div className="text-sm text-destructive">{selected.error_message || 'Erro ao gerar o roteiro.'}</div>
              )}
              {selected.status === 'done' && selected.result_html && (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: selected.result_html }} />
              )}
            </div>
          </div>
        )}
      </div>

      <NewRoteiroDialog
        orgSlug={orgSlug}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={id => { setNewOpen(false); refreshAndSelect(id) }}
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

function NewRoteiroDialog({
  orgSlug, open, onOpenChange, onCreated,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (id: string) => void
}) {
  const [mode, setMode] = useState<RoteiroMode>('completo')
  const [destino, setDestino] = useState('')
  const [periodoFlexivel, setPeriodoFlexivel] = useState(false)
  const [dataIda, setDataIda] = useState('')
  const [dataVolta, setDataVolta] = useState('')
  const [mesReferencia, setMesReferencia] = useState('')
  const [paxAdults, setPaxAdults] = useState(2)
  const [paxChildren, setPaxChildren] = useState(0)
  const [nivelConforto, setNivelConforto] = useState<string>('padrao')
  const [orcamento, setOrcamento] = useState('')
  const [interesses, setInteresses] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [generating, setGenerating] = useState(false)

  function reset() {
    setMode('completo'); setDestino(''); setPeriodoFlexivel(false)
    setDataIda(''); setDataVolta(''); setMesReferencia('')
    setPaxAdults(2); setPaxChildren(0); setNivelConforto('padrao')
    setOrcamento(''); setInteresses(''); setObservacoes('')
  }

  async function handleGenerate() {
    if (!destino.trim()) { toast.error('Informe o destino.'); return }
    setGenerating(true)
    const res = await generateRoteiroAction(orgSlug, {
      mode,
      destino,
      dataIda: periodoFlexivel ? null : (dataIda || null),
      dataVolta: periodoFlexivel ? null : (dataVolta || null),
      periodoFlexivel,
      mesReferencia: periodoFlexivel ? (mesReferencia || null) : null,
      paxAdults,
      paxChildren,
      nivelConforto,
      orcamentoCents: orcamento ? Math.round(Number(orcamento.replace(',', '.')) * 100) : null,
      interesses: interesses.trim() || null,
      observacoes: observacoes.trim() || null,
    })
    setGenerating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Roteiro sendo gerado — acompanhe na lista.')
    reset()
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Novo roteiro</DialogTitle>
          <DialogDescription>Preencha as informações — a IA pesquisa na web e monta o resultado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs ${mode === m.id ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground'}`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              )
            })}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Destino <span className="text-destructive">*</span></Label>
            <Input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex.: Porto de Galinhas, PE" />
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
                <Label className="text-xs">Volta</Label>
                <Input type="date" value={dataVolta} onChange={e => setDataVolta(e.target.value)} />
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
          <Button disabled={generating} onClick={handleGenerate}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {generating ? 'Gerando…' : 'Gerar roteiro'}
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
            Fatos que a IA considera ao gerar roteiros — ex.: "Grand Palladium tem gratuidade para até 2 CHD de até 17 anos por quarto, acompanhado de adultos pagantes."
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
