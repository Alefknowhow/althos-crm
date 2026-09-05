'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  updateTravelSale, getContatoTravelerInfo, listSaleOperatorOptions,
  type TravelSaleRow, type FlightSegment,
} from '@/actions/travel-sales'
import CancelTravelSaleDialog from '@/components/features/reservas/CancelTravelSaleDialog'
import ContratoManagerDialog from '@/components/features/reservas/ContratoManagerDialog'
import ApplyCreditDialog from '@/components/features/reservas/ApplyCreditDialog'
import SaleTasksList from '@/components/features/reservas/SaleTasksList'
import SaleProductsTab from '@/components/features/reservas/SaleProductsTab'
import VoucherUploadAndReview from '@/components/features/reservas/VoucherUploadAndReview'
import VoucherUploadWithOcr from '@/components/features/reservas/VoucherUploadWithOcr'
import VoucherExtractDialog, { type ExtractSource } from '@/components/features/reservas/VoucherExtractDialog'
import { bulkCreateSaleProductsFromExtraction } from '@/actions/sale-products'
import { extractedToSaleFieldsPatch, extractedTravelers } from '@/lib/travel-sales/apply-extraction'
import {
  MapPin, CheckCircle2, Trash2, ArrowLeft, Receipt, Plus, ExternalLink, Upload, X,
  Loader2, FileIcon, ImageIcon, Users, Save, Ban, Wallet, FileBadge, FileSignature, Sparkles,
  Package, ListTodo, Clock,
} from 'lucide-react'
import {
  Field, MoneyInput, RetainedCommissionField, OperatorInput, TravelerNameAutocomplete,
  SERVICE_LABELS, PAYMENT_METHODS, INCLUDED_ITEMS, FOCUS_RING,
  type LeadOption, type Voucher,
} from './TravelSalesViewShared'

export default function SaleEditor({
  orgSlug, sale, saving, sellerName, leads = [], onSave, onBack, onDelete,
}: {
  orgSlug: string
  sale: TravelSaleRow
  saving: boolean
  sellerName: string | null
  leads?: LeadOption[]
  onSave: (patch: Record<string, any>, generate: boolean) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [s, setS] = useState<TravelSaleRow>(sale)
  const set = (k: keyof TravelSaleRow, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const services: string[] = Array.isArray(s.services) ? s.services : []
  const included: string[] = Array.isArray(s.included_items) ? s.included_items : []
  const vouchers: Voucher[] = Array.isArray(s.vouchers) ? s.vouchers : []
  const travelers: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(s.travelers) ? s.travelers : []
  const flights: FlightSegment[] = Array.isArray(s.flights) ? s.flights : []

  const [activeTab, setActiveTab] = useState('dados')
  const [productsRefreshKey, setProductsRefreshKey] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const [operatorOptions, setOperatorOptions] = useState<string[]>([])
  const [extractSource, setExtractSource] = useState<ExtractSource | null>(null)
  const [extractLabel, setExtractLabel] = useState<string | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null)

  async function handleExtractFromUrl(v: Voucher) {
    setExtractingUrl(v.url)
    try {
      const resp = await fetch(v.url)
      if (!resp.ok) throw new Error('Não foi possível baixar o arquivo.')
      const blob = await resp.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      setExtractSource({ base64, mediaType: blob.type || 'application/pdf' })
      setExtractLabel(v.name || null)
      setExtractOpen(true)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao ler o voucher.')
    } finally {
      setExtractingUrl(null)
    }
  }

  // Política de cancelamento / informações importantes / informações de
  // serviço são texto livre em nível de venda — quando a reserva tem vários
  // vouchers (aéreo, hotel, passeio…), cada um pode trazer sua própria
  // regra. Em vez de o próximo voucher lido sobrescrever o anterior, cada
  // leitura é anexada como um bloco novo (identificado pelo nome do
  // arquivo), preservando todas as regras já capturadas.
  const APPEND_FIELDS = ['cancellation_policy', 'important_info', 'service_info'] as const
  function mergeExtractedFields(prev: TravelSaleRow, fields: Record<string, any>, sourceLabel: string | null): TravelSaleRow {
    const next: Record<string, any> = { ...fields }
    for (const key of APPEND_FIELDS) {
      if (!(key in fields) || !fields[key]) continue
      const existing = (prev as any)[key] as string | null
      const incoming = String(fields[key]).trim()
      if (existing && existing.includes(incoming)) { next[key] = existing; continue } // já foi mesclado antes
      const entry = sourceLabel ? `— ${sourceLabel} —\n${incoming}` : incoming
      next[key] = existing ? `${existing}\n\n${entry}` : entry
    }
    return { ...prev, ...next }
  }

  const router = useRouter()

  /** Botão "Add voucher" (venda já existente) — mesma extração usada na aba
   *  Vouchers, só que aplica tudo de uma vez (campos + produtos) em vez de
   *  exigir revisão item a item. O voucher em si já fica salvo mesmo se a
   *  leitura por IA falhar. */
  async function handleVoucherExtracted({ voucher, extracted }: { voucher: Voucher; extracted: import('@/lib/ai/document-extract').ExtractedTravelDocument | null }) {
    setS(prev => {
      const nextVouchers = [...(Array.isArray(prev.vouchers) ? prev.vouchers : []), voucher]
      // Voucher persiste na hora — não depende do botão "Salvar" pra
      // sobreviver a um refresh/troca de aba (mesmo padrão da aba Vouchers).
      updateTravelSale(orgSlug, prev.id, { vouchers: nextVouchers })
      if (!extracted) return { ...prev, vouchers: nextVouchers }

      const patch = extractedToSaleFieldsPatch(extracted, {
        operatorOptions,
        existingIncludedItems: Array.isArray(prev.included_items) ? prev.included_items : [],
      })
      const newTravelers = extractedTravelers(extracted)
      const existingTravelers: any[] = Array.isArray(prev.travelers) ? prev.travelers : []
      const existingNames = new Set(existingTravelers.map(t => (t.name || '').trim().toLowerCase()))
      const mergedTravelers = [...existingTravelers, ...newTravelers.filter(t => !existingNames.has(t.name.trim().toLowerCase()))]

      const merged = mergeExtractedFields({ ...prev, vouchers: nextVouchers }, patch, voucher.name)
      return { ...merged, travelers: mergedTravelers }
    })

    if (!extracted) { toast.success('Voucher adicionado.'); return }
    // Produtos não fazem parte do "Salvar" da aba Dados — persistem na hora,
    // igual o botão "Adicionar" já fazia na aba Vouchers.
    const result = await bulkCreateSaleProductsFromExtraction(orgSlug, sale.id, extracted)
    if (result.ok && result.created > 0) {
      setProductsRefreshKey(k => k + 1)
      toast.success(`Voucher lido — ${result.created} produto(s) adicionado(s) em Produtos. Revise e salve os dados da reserva.`)
    } else {
      toast.success('Voucher lido — revise e salve os dados da reserva.')
    }
  }

  useEffect(() => {
    let cancelled = false
    listSaleOperatorOptions(orgSlug).then(opts => { if (!cancelled) setOperatorOptions(opts) })
    return () => { cancelled = true }
  }, [orgSlug])

  function toggleIncluded(key: string) {
    set('included_items', included.includes(key)
      ? included.filter(k => k !== key)
      : [...included, key])
  }

  const patch = () => ({
    client_name: s.client_name, destination: s.destination,
    departure_date: s.departure_date || null, return_date: s.return_date || null,
    negotiation_days: s.negotiation_days, total_cents: s.total_cents,
    hotel_name: s.hotel_name, airline: s.airline, operator: s.operator,
    payment_method: s.payment_method, included_items: included, vouchers,
    travelers, travelers_note: s.travelers_note,
    package_locator: s.package_locator, air_locator: s.air_locator, hotel_locator: s.hotel_locator,
    airline_checkin_url: s.airline_checkin_url, commission_cents: s.commission_cents,
    retained_commission_cents: s.retained_commission_cents,
    notes: s.notes, cancellation_policy: s.cancellation_policy, important_info: s.important_info,
    service_info: s.service_info, flights,
  })

  function handleSaveClick() { onSave(patch(), false) }

  const period = (s.departure_date || s.return_date)
    ? `${s.departure_date ? new Date(s.departure_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'} → ${s.return_date ? new Date(s.return_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}`
    : null

  return (
    <div className="flex flex-col w-full">
      {/* Header — tudo numa linha só, sem segunda linha só pra botões. */}
      <div className="sticky top-0 bg-card/90 border-b p-3 sm:p-4 flex items-center gap-3 z-10 flex-wrap">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate text-[15px] flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-primary shrink-0" /> {s.client_name || 'Venda de viagem'}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {s.destination && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {s.destination}
              </span>
            )}
            {period && <span>{period}</span>}
            {sellerName && <span>Vendedor: {sellerName}</span>}
            {s.created_at && (
              <span className="inline-flex items-center gap-1 truncate" title="Data de criação da reserva">
                <Clock className="w-3 h-3 shrink-0" /> {new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {s.proposal_id && (
              <Link href={`/app/${orgSlug}/cotacoes/${s.proposal_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Ver proposta
              </Link>
            )}
          </div>
        </div>

        {/* Ações principais — visíveis, sem esconder atrás de menus. */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button size="sm" disabled={saving} onClick={handleSaveClick}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          {s.contato_id && (
            <Button variant="outline" size="sm" onClick={() => setCreditOpen(true)} title="Usar crédito de cancelamento">
              <Wallet className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Usar crédito</span>
            </Button>
          )}
          <a href={`/voucher-print/${orgSlug}/${s.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" title="Gerar voucher">
              <FileBadge className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Voucher</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" title="Contrato" onClick={() => setContractOpen(true)}>
            <FileSignature className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Contrato</span>
          </Button>
          <ContratoManagerDialog
            orgSlug={orgSlug}
            saleId={s.id}
            clientName={s.client_name}
            open={contractOpen}
            onOpenChange={setContractOpen}
          />
          {s.status !== 'cancelled' && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)} title="Cancelar reserva">
              <Ban className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Cancelar</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir venda">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dados da Reserva / Produtos / Tarefas / Vouchers / Contratos — abas no topo, cada uma gerida de forma isolada. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados">Dados da Reserva</TabsTrigger>
          <TabsTrigger value="vouchers"><Upload className="w-3.5 h-3.5 mr-1.5" /> Vouchers</TabsTrigger>
          <TabsTrigger value="tarefas"><ListTodo className="w-3.5 h-3.5 mr-1.5" /> Tarefas</TabsTrigger>
          <TabsTrigger value="produtos"><Package className="w-3.5 h-3.5 mr-1.5" /> Produtos</TabsTrigger>
        </TabsList>

        {/* ── Dados da Reserva ────────────────────────────────── */}
        <TabsContent value="dados" className="space-y-4 pt-4">
        <div className="flex justify-end">
          <VoucherUploadWithOcr orgSlug={orgSlug} label="Add voucher" onExtracted={handleVoucherExtracted} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lado esquerdo */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Cliente">
                {s.contato_id ? (
                  <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm justify-between gap-2">
                    <span className="truncate">{s.client_name || 'Cliente'}</span>
                    <Link href={`/app/${orgSlug}/contatos/${s.contato_id}`} className="shrink-0 text-primary hover:underline text-xs inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Abrir
                    </Link>
                  </div>
                ) : (
                  <Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} />
                )}
              </Field>
              <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
              <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
            </div>

            <Field label="Itens inclusos na reserva">
              <div className="flex flex-wrap gap-1.5">
                {INCLUDED_ITEMS.map(item => {
                  const active = included.includes(item.key)
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleIncluded(item.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
                        FOCUS_RING,
                        active
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-background hover:bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {services.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Operadora">
                <OperatorInput value={s.operator || ''} onChange={v => set('operator', v)} options={operatorOptions} />
              </Field>
              <Field label="Localizador"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
              <Field label="Forma de pagamento">
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {PAYMENT_METHODS.map(m => {
                    const selectedMethods = (s.payment_method || '').split(',').map((x: string) => x.trim()).filter(Boolean)
                    const active = selectedMethods.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const next = active ? selectedMethods.filter((x: string) => x !== m) : [...selectedMethods, m]
                          set('payment_method', next.length ? next.join(', ') : null)
                        }}
                        className={cn(
                          'px-2 h-8 rounded-lg border text-[11px] font-medium transition-colors',
                          FOCUS_RING,
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-2">Valores</p>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
                <Field label="Comissão">
                  <MoneyInput
                    value={s.commission_cents || 0}
                    onChange={c => {
                      set('commission_cents', c)
                      if (s.retained_commission_cents != null && s.retained_commission_cents > c) {
                        set('retained_commission_cents', c > 0 ? c : null)
                      }
                    }}
                  />
                </Field>
                <RetainedCommissionField
                  commissionCents={s.commission_cents || 0}
                  retainedCents={s.retained_commission_cents}
                  onChange={v => set('retained_commission_cents', v)}
                />
              </div>
            </div>
          </div>

          {/* Lado direito */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5 lg:min-h-[280px]">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Viajantes</p>
            </div>
            <div className="space-y-2">
              {travelers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border bg-background/40 p-2">
                  <div className="flex-1 min-w-[180px] space-y-1 relative">
                    <Label className="text-[11px] text-muted-foreground">Nome completo</Label>
                    <TravelerNameAutocomplete
                      leads={leads}
                      value={t.name || ''}
                      onChangeText={v => { const n = [...travelers]; n[i] = { ...n[i], name: v }; set('travelers', n) }}
                      onPickLead={async (leadId) => {
                        const res = await getContatoTravelerInfo(orgSlug, leadId)
                        if (!res.ok) { toast.error(res.error); return }
                        const n = [...travelers]; n[i] = res.data; set('travelers', n)
                      }}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Nascimento</Label>
                    <Input type="date" value={t.birth_date || ''}
                      onChange={e => { const n = [...travelers]; n[i] = { ...n[i], birth_date: e.target.value }; set('travelers', n) }} />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">CPF</Label>
                    <Input placeholder="000.000.000-00" inputMode="numeric" value={t.cpf || ''}
                      onChange={e => { const n = [...travelers]; n[i] = { ...n[i], cpf: e.target.value }; set('travelers', n) }} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => set('travelers', travelers.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set('travelers', [...travelers, { name: '', birth_date: '', cpf: '' }])}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar viajante
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <Field label="Observações"><Textarea rows={2} value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
          <Field label="Informações importantes">
            <Textarea rows={2} value={s.important_info || ''} onChange={e => set('important_info', e.target.value)}
              placeholder="Contatos de emergência, como buscar atendimento etc." />
          </Field>
          <Field label="Política de cancelamento">
            <Textarea rows={2} value={s.cancellation_policy || ''} onChange={e => set('cancellation_policy', e.target.value)}
              placeholder="Aparece no voucher/contrato só se preenchido." />
          </Field>
          <Field label="Informações de serviço">
            <Textarea rows={2} value={s.service_info || ''} onChange={e => set('service_info', e.target.value)}
              placeholder="O que está incluso, horários, condições de uso etc." />
          </Field>
        </div>

        {s.tasks_generated_at && (
          <p className="text-xs text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
          </p>
        )}
        </TabsContent>

        {/* ── Produtos ────────────────────────────────────────── */}
        <TabsContent value="produtos" className="pt-4">
          <SaleProductsTab orgSlug={orgSlug} saleId={s.id} refreshKey={productsRefreshKey} />
        </TabsContent>

        {/* ── Tarefas ─────────────────────────────────────────── */}
        <TabsContent value="tarefas" className="pt-4">
          <SaleTasksList orgSlug={orgSlug} saleId={s.id} clientId={s.contato_id} clientName={s.client_name} />
        </TabsContent>

        {/* ── Vouchers ────────────────────────────────────────── */}
        <TabsContent value="vouchers" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <VoucherUploadAndReview
                orgSlug={orgSlug}
                onVoucherAdded={v => {
                  setS(prev => {
                    const next = [...(Array.isArray(prev.vouchers) ? prev.vouchers : []), v]
                    // Persiste na hora — não depende do botão "Salvar" pra o
                    // voucher recém-enviado sobreviver a um refresh/troca de aba.
                    updateTravelSale(orgSlug, prev.id, { vouchers: next })
                    return { ...prev, vouchers: next }
                  })
                }}
              />
            </div>
            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vouchers / comprovantes</p>
              {vouchers.length > 0 ? (
                <ul className="space-y-1.5">
                  {vouchers.map((v, i) => {
                    const isPdf = /\.pdf($|\?)/i.test(v.url) || /\.pdf$/i.test(v.name)
                    return (
                      <li key={`${v.url}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                        {isPdf
                          ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
                          : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                        <a href={v.url} target="_blank" rel="noopener noreferrer"
                          className="flex-1 min-w-0 truncate text-xs text-foreground hover:underline">
                          {v.name || `Voucher ${i + 1}`}
                        </a>
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">Importado pelo agente</span>
                        <Button
                          type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          disabled={extractingUrl === v.url}
                          onClick={() => handleExtractFromUrl(v)}
                        >
                          {extractingUrl === v.url
                            ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                          Extrair dados
                        </Button>
                        <button
                          type="button"
                          onClick={() => set('vouchers', vouchers.filter((_, idx) => idx !== i))}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Remover voucher"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground border rounded-lg p-4 text-center">Nenhum voucher enviado ainda.</p>
              )}
            </div>
          </div>

          <VoucherExtractDialog
            orgSlug={orgSlug}
            saleId={s.id}
            source={extractSource}
            open={extractOpen}
            onOpenChange={setExtractOpen}
            onScalarFieldsExtracted={fields => setS(prev => mergeExtractedFields(prev, fields, extractLabel))}
            onTravelersExtracted={others => {
              setS(prev => {
                const existing: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(prev.travelers) ? prev.travelers : []
                const existingNames = new Set(existing.map(t => (t.name || '').trim().toLowerCase()))
                const toAdd = others.filter(o => !existingNames.has(o.name.trim().toLowerCase()))
                return toAdd.length > 0 ? { ...prev, travelers: [...existing, ...toAdd] } : prev
              })
            }}
            onProductCreated={() => setProductsRefreshKey(k => k + 1)}
          />
        </TabsContent>

      </Tabs>

      <CancelTravelSaleDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orgSlug={orgSlug}
        saleId={s.id}
        onCancelled={() => { set('status', 'cancelled'); router.refresh() }}
      />

      {s.contato_id && (
        <ApplyCreditDialog
          open={creditOpen}
          onOpenChange={setCreditOpen}
          orgSlug={orgSlug}
          contatoId={s.contato_id}
          saleId={s.id}
          remainingCents={s.total_cents || 0}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  )
}
