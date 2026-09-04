'use client'

/**
 * "Começar com formulário" quick-start dialog for RoteiristaView. Split
 * out of RoteiristaView.tsx.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Sparkles, Loader2, Wand2 } from 'lucide-react'
import { startRoteiro } from '@/actions/roteirista'
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

export function QuickStartDialog({
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
