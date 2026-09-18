'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  CheckCircle2, Copy, ExternalLink, FileText, Pencil, Trash2,
  CopyPlus, MessageCircle, ShoppingBag, ShoppingCart, Loader2,
} from 'lucide-react'
import { generateQuotationLink, convertQuotationToOffer, createSaleFromQuotation } from '@/actions/quotations'
import type { ProposalRow } from '@/actions/travel-proposals'

/** Botão de ação só ícone — mesmo estilo (`Button variant="outline"
 *  size="icon"`) usado nas outras listas em grid de cards (Automações,
 *  Formulários), pra ficar consistente em todo o app. */
function RowActionButton({
  icon: Icon, label, onClick, href, newTab = true, disabled, tone,
}: {
  icon: any
  label: string
  onClick?: () => void
  href?: string
  /** false navega na mesma aba (Editar); true abre em nova aba (Abrir/Gerar PDF). */
  newTab?: boolean
  disabled?: boolean
  tone?: 'destructive'
}) {
  const className = cn(
    buttonVariants({ variant: 'outline', size: 'icon' }),
    'h-8 w-8 shrink-0',
    tone === 'destructive' && 'text-destructive hover:text-destructive',
  )
  if (href && !disabled) {
    if (!newTab) {
      return (
        <Link href={href} className={className} title={label} aria-label={label}>
          <Icon className="w-3.5 h-3.5" />
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={label} aria-label={label}>
        <Icon className="w-3.5 h-3.5" />
      </a>
    )
  }
  return (
    <button type="button" className={className} title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

/** Segundo bloco de ações — skin quadrada e cor sólida (bem diferente do
 *  primeiro bloco, outline), separado por um "|". Fazem parte do fluxo
 *  comercial da cotação (duplicar/enviar/converter), por isso o
 *  destaque visual maior. */
function SolidActionButton({
  icon: Icon, label, onClick, disabled, loading,
}: { icon: any; label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  )
}

export function ProposalRowActions({
  orgSlug, p, onDelete, onDuplicate,
}: {
  orgSlug: string
  p: ProposalRow
  onDelete: () => void
  /** Abre o diálogo de duplicar (escolher outro lead/contato) — vive no pai
   *  porque precisa da lista de contatos da org. */
  onDuplicate: () => void
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [convertingOffer, setConvertingOffer] = useState(false)
  const [generatingSale, setGeneratingSale] = useState(false)

  useEffect(() => {
    if (p.public_token) setPublicUrl(`${window.location.origin}/p/${p.public_token}`)
  }, [p.public_token])

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { toast.error('Não foi possível copiar') }
  }

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
    <div className="flex items-center justify-end gap-1">
      <RowActionButton icon={Pencil} label="Editar" href={`/app/${orgSlug}/cotacoes/${p.id}`} newTab={false} />
      <RowActionButton
        icon={copied ? CheckCircle2 : Copy}
        label={copied ? 'Copiado' : 'Copiar link'}
        onClick={copyLink}
        disabled={!publicUrl}
      />
      <RowActionButton
        icon={ExternalLink}
        label="Abrir"
        href={publicUrl || undefined}
        disabled={!publicUrl}
      />
      <RowActionButton icon={FileText} label="Gerar PDF" href={`/app/${orgSlug}/cotacoes/${p.id}/pdf`} />
      <RowActionButton icon={Trash2} label="Excluir" onClick={onDelete} tone="destructive" />

      <span className="w-px h-5 bg-border mx-1" aria-hidden />

      <SolidActionButton icon={CopyPlus} label="Duplicar" onClick={onDuplicate} />
      <SolidActionButton icon={MessageCircle} label="Enviar ao cliente" onClick={handleSendToClient} loading={sending} disabled={sending} />
      <SolidActionButton icon={ShoppingBag} label="Adicionar a ofertas" onClick={handleAddToOffers} loading={convertingOffer} disabled={convertingOffer} />
      <SolidActionButton icon={ShoppingCart} label="Gerar reserva" onClick={handleGenerateReserva} loading={generatingSale} disabled={generatingSale} />
    </div>
  )
}
