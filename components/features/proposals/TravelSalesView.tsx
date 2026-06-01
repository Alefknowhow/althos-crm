'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/utils'
import {
  updateTravelSale, saveTravelSaleAndGenerateTasks, deleteTravelSale, createTravelSale, type TravelSaleRow,
} from '@/actions/travel-sales'
import { toast } from 'sonner'
import {
  Plane, MapPin, Hotel, CalendarRange, CheckCircle2, ListChecks, Trash2, Pencil, Receipt, Plus, FileText,
} from 'lucide-react'

type ProposalOption = { id: string; title: string | null; client_name: string | null }

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado', insurance: 'Seguro viagem', car_rental: 'Locação de carro',
}

function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function fmtDate(d?: string | null) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }

function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}

export default function TravelSalesView({
  orgSlug, sales, proposals = [],
}: {
  orgSlug: string
  sales: TravelSaleRow[]
  proposals?: ProposalOption[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<TravelSaleRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pickedProposal, setPickedProposal] = useState<string>('none')

  async function handleDelete(id: string) {
    const res = await deleteTravelSale(orgSlug, id)
    if (res.ok) { toast.success('Venda excluída'); router.refresh() }
    else toast.error(res.error)
  }

  async function handleCreate() {
    setCreating(true)
    const res = await createTravelSale(orgSlug, pickedProposal === 'none' ? null : pickedProposal)
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    setNewOpen(false)
    setPickedProposal('none')
    toast.success('Venda criada')
    setEditing(res.data)        // open editor immediately to fill operational data
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova venda
        </Button>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma venda de viagem ainda"
          description="Crie uma venda manualmente com o botão 'Nova venda' (importando uma proposta), ou mova um lead com proposta vinculada para a etapa 'Fechado' no pipeline — a venda é gerada automaticamente."
        />
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sales.map(s => (
          <Card key={s.id} className="group relative">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate">{s.client_name || 'Cliente'}</p>
                  {s.destination && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> <span className="truncate">{s.destination}</span>
                    </p>
                  )}
                </div>
                {s.tasks_generated_at
                  ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">Tarefas geradas</Badge>
                  : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">Pendente</Badge>}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> {fmtDate(s.departure_date)} – {fmtDate(s.return_date)}</div>
                {s.hotel_name && <div className="flex items-center gap-1.5"><Hotel className="w-3.5 h-3.5" /> <span className="truncate">{s.hotel_name}</span></div>}
                {s.airline && <div className="flex items-center gap-1.5"><Plane className="w-3.5 h-3.5" /> <span className="truncate">{s.airline}</span></div>}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-base font-bold tabular-nums">{formatCurrency(s.total_cents || 0)}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(s)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Nova venda — import from proposal or start blank */}
      <Dialog open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) setPickedProposal('none') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nova venda de viagem</DialogTitle>
            <DialogDescription>
              Importe uma proposta para preencher os dados automaticamente, ou comece em branco.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label className="text-xs">Importar de uma proposta</Label>
            <Select value={pickedProposal} onValueChange={setPickedProposal}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma proposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Começar em branco</SelectItem>
                {proposals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.title || 'Proposta sem título')}{p.client_name ? ` · ${p.client_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {proposals.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Nenhuma proposta criada ainda — a venda começará em branco.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button disabled={creating} onClick={handleCreate}>
              {creating ? 'Criando…' : 'Criar venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editing && (
            <SaleEditor
              key={editing.id}
              sale={editing}
              saving={saving}
              onSave={async (patch, generate) => {
                setSaving(true)
                const res = generate
                  ? await saveTravelSaleAndGenerateTasks(orgSlug, editing.id, patch)
                  : await updateTravelSale(orgSlug, editing.id, patch)
                setSaving(false)
                if (!res.ok) { toast.error(res.error); return }
                if (generate) {
                  const r = res as any
                  if (r.alreadyGenerated) toast.info('As tarefas dessa venda já haviam sido geradas.')
                  else toast.success(`Venda salva e ${r.tasksCreated} tarefa(s) criada(s).`)
                } else {
                  toast.success('Venda salva')
                }
                setEditing(null)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. As tarefas já criadas não serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SaleEditor({
  sale, saving, onSave,
}: {
  sale: TravelSaleRow
  saving: boolean
  onSave: (patch: Record<string, any>, generate: boolean) => void
}) {
  const [s, setS] = useState<TravelSaleRow>(sale)
  const set = (k: keyof TravelSaleRow, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const services: string[] = Array.isArray(s.services) ? s.services : []

  const patch = () => ({
    client_name: s.client_name, destination: s.destination,
    departure_date: s.departure_date || null, return_date: s.return_date || null,
    negotiation_days: s.negotiation_days, total_cents: s.total_cents,
    hotel_name: s.hotel_name, airline: s.airline, payment_method: s.payment_method,
    package_locator: s.package_locator, air_locator: s.air_locator,
    airline_checkin_url: s.airline_checkin_url, commission_cents: s.commission_cents,
    notes: s.notes,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Venda de viagem</DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-2">
        {/* Auto-filled (editable) */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados da viagem (pré-preenchidos)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente"><Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} /></Field>
            <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
            <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
            <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
            <Field label="Hotel"><Input value={s.hotel_name || ''} onChange={e => set('hotel_name', e.target.value)} /></Field>
            <Field label="Companhia aérea"><Input value={s.airline || ''} onChange={e => set('airline', e.target.value)} /></Field>
            <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
            <Field label="Forma de pagamento"><Input value={s.payment_method || ''} onChange={e => set('payment_method', e.target.value)} /></Field>
            <Field label="Tempo de negociação (dias)"><Input type="number" min="0" value={s.negotiation_days ?? ''} onChange={e => set('negotiation_days', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          </div>
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
            </div>
          )}
        </div>

        {/* Manual fields */}
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Dados operacionais (preencha manualmente)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Localizador do pacote"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
            <Field label="Localizador aéreo"><Input value={s.air_locator || ''} onChange={e => set('air_locator', e.target.value)} placeholder="Ex.: ABC123" /></Field>
            <Field label="Link de check-in da cia (opcional)"><Input value={s.airline_checkin_url || ''} onChange={e => set('airline_checkin_url', e.target.value)} placeholder="https://..." /></Field>
            <Field label="Comissão"><MoneyInput value={s.commission_cents || 0} onChange={c => set('commission_cents', c)} /></Field>
          </div>
        </div>

        <Field label="Observações"><Textarea value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>

        {s.tasks_generated_at && (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
          </p>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={saving} onClick={() => onSave(patch(), false)}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button disabled={saving || !!s.tasks_generated_at} onClick={() => onSave(patch(), true)}>
          <ListChecks className="w-4 h-4 mr-1.5" /> {saving ? 'Processando…' : 'Salvar e gerar tarefas'}
        </Button>
      </DialogFooter>
    </>
  )
}
