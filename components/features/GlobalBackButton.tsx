'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Botão "voltar" no topo, visível em qualquer página que NÃO seja a raiz de
 * um módulo primário da sidebar (ex.: some em /app/x/financeiro, aparece em
 * /app/x/financeiro/... não existe hoje pois Financeiro usa abas internas —
 * mas aparece em /app/x/marketing/contas, /app/x/forms/123/edit, etc).
 * Sobe um nível na URL (remove o último segmento), não history.back(), pra
 * funcionar de forma previsível mesmo em acesso direto por link.
 */
export function GlobalBackButton({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const prefix = `/app/${orgSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const segments = rest.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const parentPath = `${prefix}/${segments.slice(0, -1).join('/')}`

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label="Voltar"
      onClick={() => router.push(parentPath)}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  )
}
