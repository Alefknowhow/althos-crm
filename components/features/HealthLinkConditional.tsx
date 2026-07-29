'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Activity } from 'lucide-react'

/** Botão "Saúde" só aparece em Configurações/Integrações — nas outras abas não faz sentido. */
export default function HealthLinkConditional({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  if (!pathname?.includes(`/app/${orgSlug}/configuracoes`)) return null

  return (
    <Link
      href={`/app/${orgSlug}/configuracoes/integracoes/saude`}
      aria-label="Saúde das integrações"
      title="Saúde das integrações"
      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
    >
      <Activity className="w-3.5 h-3.5" />
      <span className="hidden lg:inline">Saúde</span>
    </Link>
  )
}
