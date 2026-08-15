'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MessageCircle, MessageSquareText, Zap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Abas internas do hub do Instagram: Direct Inbox (inbox manual) ↔ Comentários
 * (resposta manual) ↔ Automações (regras + funis). O botão de conexão do
 * Instagram fica sempre aqui do lado, único lugar de onde se conecta/gerencia
 * a conta — não duplicado em cada aba.
 */
export default function InstagramTabsNav({ orgSlug, connected }: { orgSlug: string; connected: boolean }) {
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}`
  const onComentarios = pathname.includes('/social/comentarios')
  const onAutomacoes = pathname.includes('/social/automacoes')
  const onInbox = !onComentarios && !onAutomacoes

  const tabs = [
    { label: 'Direct Inbox', href: `${base}/social/inbox`, icon: <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, active: onInbox },
    { label: 'Comentários', href: `${base}/social/comentarios`, icon: <MessageSquareText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, active: onComentarios },
    { label: 'Automações', href: `${base}/social/automacoes`, icon: <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, active: onAutomacoes },
  ]

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
      {/* Mobile: as 3 abas dividem o espaço em partes iguais (grid), fonte
          menor pra não cortar texto. Desktop: largura natural, lado a lado. */}
      <nav className="grid grid-cols-3 gap-1 flex-1 min-w-0 sm:flex sm:flex-none" aria-label="Áreas do Instagram">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-md transition-colors truncate',
              t.active
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.icon} <span className="truncate">{t.label}</span>
          </Link>
        ))}
      </nav>
      {connected ? (
        <Button variant="outline" size="sm" className="shrink-0 px-2 sm:px-3" asChild>
          <Link href={`/app/${orgSlug}/configuracoes/social`}>
            <span className="hidden sm:inline">Instagram conectado</span>
            <span className="sm:hidden">Conectado</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          className="shrink-0 px-2 sm:px-3"
          onClick={() => { window.location.href = `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}` }}
        >
          <span className="hidden sm:inline">Conectar Instagram</span>
          <span className="sm:hidden">Conectar</span>
        </Button>
      )}
    </div>
  )
}
