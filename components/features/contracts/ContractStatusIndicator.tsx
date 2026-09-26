'use client'

/**
 * Indicador de status de contrato (issue #60, B.3) — ícone + texto +
 * tooltip, nunca só cor. Clique: se já existe contrato, abre o detalhe; se
 * ausente, abre a Gestão de Contratos com a origem pré-preenchida
 * (`?origin=&id=`).
 */

import Link from 'next/link'
import { CheckCircle2, Clock, FileText, FileX, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContractStatusInfo } from '@/actions/contracts-origin'

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  draft: { label: 'Rascunho', icon: FileText, className: 'text-muted-foreground' },
  ready: { label: 'Pronto', icon: FileText, className: 'text-muted-foreground' },
  sent: { label: 'Pendente (enviado)', icon: Clock, className: 'text-amber-600' },
  viewed: { label: 'Visualizado', icon: Clock, className: 'text-amber-600' },
  awaiting_signature: { label: 'Aguardando assinatura', icon: Clock, className: 'text-amber-600' },
  signed: { label: 'Assinado', icon: CheckCircle2, className: 'text-emerald-600' },
  rejected: { label: 'Recusado', icon: XCircle, className: 'text-red-600' },
  expired: { label: 'Expirado', icon: AlertCircle, className: 'text-red-600' },
  cancelled: { label: 'Cancelado', icon: FileX, className: 'text-muted-foreground' },
}

export default function ContractStatusIndicator({
  orgSlug, status, originType, originId, className,
}: {
  orgSlug: string
  status: ContractStatusInfo
  originType: 'reserva' | 'venda' | 'oportunidade' | 'cliente' | 'projeto'
  originId: string
  className?: string
}) {
  if (!status) {
    return (
      <Link
        href={`/app/${orgSlug}/contratos?origin=${originType}&id=${originId}`}
        title="Nenhum contrato criado ainda — clique pra criar"
        className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground', className)}
      >
        <FileX className="w-3.5 h-3.5" /> Ausente
      </Link>
    )
  }

  const meta = STATUS_META[status.status] || STATUS_META.draft
  const Icon = meta.icon

  return (
    <Link
      href={`/app/${orgSlug}/contratos/${status.contractId}`}
      title={`Contrato: ${meta.label}`}
      className={cn('inline-flex items-center gap-1 text-xs hover:underline', meta.className, className)}
    >
      <Icon className="w-3.5 h-3.5" /> {meta.label}
    </Link>
  )
}
