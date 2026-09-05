'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  updateTravelSale, listSaleOperatorOptions,
  type TravelSaleRow, type FlightSegment,
} from '@/actions/travel-sales'
import CancelTravelSaleDialog from '@/components/features/reservas/CancelTravelSaleDialog'
import ApplyCreditDialog from '@/components/features/reservas/ApplyCreditDialog'
import SaleTasksList from '@/components/features/reservas/SaleTasksList'
import SaleProductsTab from '@/components/features/reservas/SaleProductsTab'
import { TabsContent } from '@/components/ui/tabs'
import { bulkCreateSaleProductsFromExtraction } from '@/actions/sale-products'
import { extractedToSaleFieldsPatch, extractedTravelers } from '@/lib/travel-sales/apply-extraction'
import { Upload, Package, ListTodo } from 'lucide-react'
import { type LeadOption, type Voucher } from './TravelSalesViewShared'
import TravelSalesViewSaleEditorHeader from './TravelSalesViewSaleEditorHeader'
import TravelSalesViewSaleEditorDadosTab from './TravelSalesViewSaleEditorDadosTab'
import TravelSalesViewSaleEditorVouchersTab from './TravelSalesViewSaleEditorVouchersTab'

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
  const [extractSource, setExtractSource] = useState<import('@/components/features/reservas/VoucherExtractDialog').ExtractSource | null>(null)
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
      <TravelSalesViewSaleEditorHeader
        orgSlug={orgSlug} s={s} sellerName={sellerName} saving={saving} period={period}
        onBack={onBack} onDelete={onDelete} handleSaveClick={handleSaveClick}
        setCreditOpen={setCreditOpen} contractOpen={contractOpen} setContractOpen={setContractOpen}
        setCancelOpen={setCancelOpen}
      />

      {/* Dados da Reserva / Produtos / Tarefas / Vouchers / Contratos — abas no topo, cada uma gerida de forma isolada. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados">Dados da Reserva</TabsTrigger>
          <TabsTrigger value="vouchers"><Upload className="w-3.5 h-3.5 mr-1.5" /> Vouchers</TabsTrigger>
          <TabsTrigger value="tarefas"><ListTodo className="w-3.5 h-3.5 mr-1.5" /> Tarefas</TabsTrigger>
          <TabsTrigger value="produtos"><Package className="w-3.5 h-3.5 mr-1.5" /> Produtos</TabsTrigger>
        </TabsList>

        <TravelSalesViewSaleEditorDadosTab
          orgSlug={orgSlug} s={s} set={set} services={services} included={included}
          toggleIncluded={toggleIncluded} travelers={travelers} leads={leads}
          operatorOptions={operatorOptions} onExtracted={handleVoucherExtracted}
        />

        {/* ── Produtos ────────────────────────────────────────── */}
        <TabsContent value="produtos" className="pt-4">
          <SaleProductsTab orgSlug={orgSlug} saleId={s.id} refreshKey={productsRefreshKey} />
        </TabsContent>

        {/* ── Tarefas ─────────────────────────────────────────── */}
        <TabsContent value="tarefas" className="pt-4">
          <SaleTasksList orgSlug={orgSlug} saleId={s.id} clientId={s.contato_id} clientName={s.client_name} />
        </TabsContent>

        <TravelSalesViewSaleEditorVouchersTab
          orgSlug={orgSlug} s={s} setS={setS} set={set} vouchers={vouchers}
          extractingUrl={extractingUrl} handleExtractFromUrl={handleExtractFromUrl}
          extractSource={extractSource} extractOpen={extractOpen} setExtractOpen={setExtractOpen}
          extractLabel={extractLabel} mergeExtractedFields={mergeExtractedFields}
          setProductsRefreshKey={setProductsRefreshKey}
        />

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
