'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Copy, CheckCircle2, ExternalLink, FileText, Pencil, Trash2,
  CopyPlus, MessageCircle, ShoppingBag, ShoppingCart, MoreHorizontal,
} from 'lucide-react'
import { generateQuotationLink, convertQuotationToOffer, createSaleFromQuotation } from '@/actions/quotations'
import type { ProposalRow } from '@/actions/travel-proposals'

/** Botão secundário padronizado (32x32, neutro) — usado por Editar,
 *  WhatsApp e o menu "•••". Nunca preenchido/azul: azul fica só com a
 *  ação primária (Abrir). */
function SecondaryIconButton({
  icon: Icon, label, onClick, disabled, loading,
}: { icon: any; label: string; onClick?: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon className={cn('w-4 h-4', loading && 'animate-spin')} />
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

  function openQuotation() {
    router.push(`/app/${orgSlug}/cotacoes/${p.id}`)
  }

  async function copyLink() {
    let url = publicUrl
    if (!url) {
      const res = await generateQuotationLink(orgSlug, p.id, false)
      if (!res.ok) { toast.error(res.error); return }
      url = `${window.location.origin}/p/${res.token}`
      setPublicUrl(url)
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copiado')
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

  const isWon = p.status === 'won'

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={openQuotation}
        className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        Abrir
      </button>

      {!isWon && (
        <SecondaryIconButton icon={Pencil} label="Editar cotação" onClick={openQuotation} />
      )}

      <SecondaryIconButton
        icon={MessageCircle}
        label="Enviar mensagem"
        onClick={handleSendToClient}
        loading={sending}
        disabled={sending}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Mais ações"
            aria-label="Mais ações"
            className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={openQuotation}>
            <ExternalLink className="w-4 h-4" /> Abrir cotação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <CopyPlus className="w-4 h-4" /> Duplicar cotação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}>
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Link copiado' : 'Copiar link público'}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/app/${orgSlug}/cotacoes/${p.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileText className="w-4 h-4" /> Gerar / visualizar documento
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAddToOffers} disabled={convertingOffer}>
            <ShoppingBag className="w-4 h-4" /> Adicionar ao pipeline (ofertas)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGenerateReserva} disabled={generatingSale}>
            <ShoppingCart className="w-4 h-4" /> Converter em venda / criar reserva
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" /> Excluir cotação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
