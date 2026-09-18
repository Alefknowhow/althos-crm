'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { CheckCircle2, Copy, ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react'
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

export function ProposalRowActions({
  orgSlug, p, onDelete,
}: {
  orgSlug: string
  p: ProposalRow
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
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
    </div>
  )
}
