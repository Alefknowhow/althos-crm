import Link from 'next/link'
import { Lock } from 'lucide-react'

interface Props {
  orgSlug: string
}

/**
 * Persistent banner shown when the org is frozen (trial expired without a
 * paid subscription, or a canceled subscription). The layout still renders
 * children normally — this is read-only mode, not a lockout — but every
 * mutating server action must call assertOrgWritable() to actually refuse
 * writes (lib/billing/plans.ts).
 */
export default function FrozenBanner({ orgSlug }: Props) {
  return (
    <div className="w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium bg-destructive text-destructive-foreground">
      <Lock className="w-4 h-4 shrink-0" />
      <span>
        Conta em modo somente leitura — seu teste expirou ou a assinatura foi cancelada. Seus dados continuam aqui, mas criar/editar/excluir fica bloqueado até assinar.
      </span>
      <Link
        href={`/app/${orgSlug}/upgrade`}
        className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition-colors"
      >
        Assinar agora
      </Link>
    </div>
  )
}
