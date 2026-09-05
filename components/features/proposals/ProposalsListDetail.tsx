'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { generateQuotationLink, convertQuotationToOffer, createSaleFromQuotation, getQuotationProductsSummary } from '@/actions/quotations'
import type { ProposalRow } from '@/actions/travel-proposals'
import {
  Users, MapPin, CalendarRange, Wallet, Clock, UserCircle2,
  ArrowLeft, CopyPlus, Loader2, MessageCircle, ShoppingBag, ShoppingCart,
  Plane, Building2, Ship, Car, Shield, Compass, Bus,
} from 'lucide-react'
import { fmtDate, fmtTimestamp, destOf } from './ProposalsListHelpers'

const PRODUCT_TYPE_META: Record<string, { label: string; icon: any }> = {
  aereo: { label: 'Aéreo', icon: Plane },
  hospedagem: { label: 'Hospedagem', icon: Building2 },
  cruzeiro: { label: 'Cruzeiro', icon: Ship },
  transfer: { label: 'Traslado', icon: Bus },
  passeio: { label: 'Passeio', icon: Compass },
  seguro: { label: 'Seguro viagem', icon: Shield },
  locacao: { label: 'Locação de carro', icon: Car },
}
const PRODUCT_TYPE_ORDER = ['aereo', 'hospedagem', 'cruzeiro', 'transfer', 'passeio', 'seguro', 'locacao']

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

export function ProposalDetail({
  orgSlug, p, sellerName, onBack, onDuplicate,
}: {
  orgSlug: string
  p: ProposalRow
  sellerName: string | null
  onBack: () => void
  onDuplicate: () => void
}) {
  const router = useRouter()
  const dest = destOf(p)
  const travelers = Array.isArray(p.travelers) ? p.travelers : []
  const [sending, setSending] = useState(false)
  const [convertingOffer, setConvertingOffer] = useState(false)
  const [generatingSale, setGeneratingSale] = useState(false)
  const [products, setProducts] = useState<{ product_type: string; name: string | null }[]>([])

  useEffect(() => {
    let cancelled = false
    getQuotationProductsSummary(orgSlug, p.id).then(rows => { if (!cancelled) setProducts(rows) })
    return () => { cancelled = true }
  }, [orgSlug, p.id])

  const productsByType = useMemo(() => {
    const map = new Map<string, { product_type: string; name: string | null }[]>()
    for (const prod of products) {
      const list = map.get(prod.product_type) || []
      list.push(prod)
      map.set(prod.product_type, list)
    }
    return map
  }, [products])

  async function handleSendToClient() {
    setSending(true)
    let token = p.public_token
    if (!token) {
      const res = await generateQuotationLink(orgSlug, p.id, false)
      if (!res.ok) { toast.error(res.error); setSending(false); return }
      token = res.token
    }
    setSending(false)
    const url = `${window.location.origin}/p/${token}`
    const firstName = (p.client_name || '').trim().split(/\s+/)[0]
    const msg = `Oi${firstName ? ` ${firstName}` : ''}! Preparei sua proposta de viagem${p.title ? ` — ${p.title}` : ''}. Dá uma olhada com carinho: ${url}`
    // Sem telefone disponível nesta prévia (ProposalRow não traz o contato
    // completo) — abre o WhatsApp sem destinatário, escolhido na hora.
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    toast.info('Escolha o destinatário no WhatsApp.')
  }

  async function handleAddToOffers() {
    setConvertingOffer(true)
    const res = await convertQuotationToOffer(orgSlug, p.id)
    setConvertingOffer(false)
    if (res.ok) { toast.success('Cotação copiada para uma nova oferta'); router.push(`/app/${orgSlug}/ofertas/${res.id}`) }
    else toast.error(res.error)
  }

  async function handleGenerateReserva() {
    setGeneratingSale(true)
    const res = await createSaleFromQuotation(orgSlug, p.id)
    setGeneratingSale(false)
    if (res.ok) {
      toast.success(res.existed ? 'Esta cotação já tinha uma reserva — abrindo…' : 'Reserva criada com os dados da cotação')
      router.push(`/app/${orgSlug}/reservas?sale=${res.saleId}`)
    } else toast.error(res.error)
  }

  return (
    <div className="flex flex-col w-full">
      {/* header */}
      <div className="sticky top-0 bg-card/90   border-b p-4 flex flex-col gap-2 sm:flex-row sm:items-center z-10">
        {/* Título — pequeno, negrito e discreto no mobile; normal no desktop */}
        <h2 className="order-1 min-w-0 sm:flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:text-base sm:font-semibold sm:normal-case sm:tracking-normal sm:text-foreground">
          {p.title || 'Proposta sem título'}
        </h2>
        <div className="order-2 flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto">
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={onDuplicate}
            title="Copiar proposta para outro lead/contato"
            aria-label="Copiar proposta para outro lead/contato"
          >
            <CopyPlus className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Duplicar</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleSendToClient} disabled={sending}
            title="Enviar ao cliente" aria-label="Enviar ao cliente"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Enviar ao cliente</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleAddToOffers} disabled={convertingOffer}
            title="Adicionar a ofertas" aria-label="Adicionar a ofertas"
          >
            {convertingOffer ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Adicionar a ofertas</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleGenerateReserva} disabled={generatingSale}
            title="Gerar reserva" aria-label="Gerar reserva"
          >
            {generatingSale ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Gerar reserva</span>
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {Array.isArray(p.photos) && p.photos.length > 0 && p.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photos[0]}
            alt="Foto de capa"
            className="w-full max-h-56 object-cover rounded-lg border"
          />
        )}
        <div className="text-2xl font-bold tabular-nums">{formatCurrency(p.total_cents || 0)}</div>

        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow icon={Users} label="Cliente" value={p.client_name || '—'} />
          <DetailRow icon={MapPin} label="Destino" value={dest || '—'} />
          <DetailRow icon={CalendarRange} label="Período" value={`${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`} />
          <DetailRow icon={Users} label="Nº de pessoas" value={p.pax_count ?? '—'} />
          <DetailRow icon={Wallet} label="Valor por pessoa" value={p.price_per_person_cents ? formatCurrency(p.price_per_person_cents) : '—'} />
          <DetailRow icon={Clock} label="Criada em" value={fmtTimestamp(p.created_at)} />
          {sellerName && <DetailRow icon={UserCircle2} label="Vendedor" value={sellerName} />}
        </div>

        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
          Cotação realizada em {fmtTimestamp(p.created_at)}. Preços e tarifas estão sujeitos a alterações sem aviso prévio.
        </p>

        {productsByType.size > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Produtos inclusos</p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_TYPE_ORDER.filter(t => productsByType.has(t)).map(type => {
                const rows = productsByType.get(type)!
                const meta = PRODUCT_TYPE_META[type]
                const Icon = meta.icon
                const names = rows.map(r => r.name).filter(Boolean).join(', ')
                return (
                  <span
                    key={type}
                    title={names || undefined}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                    {meta.label}{rows.length > 1 ? ` (${rows.length})` : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {travelers.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Viajantes</p>
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t: any, i: number) => (
                <Badge key={i} variant="secondary">{t.name || 'Sem nome'}{t.age ? ` · ${t.age}` : ''}</Badge>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
