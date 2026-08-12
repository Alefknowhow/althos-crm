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
    { label: 'Direct Inbox', href: `${base}/social/inbox`, icon: <MessageCircle className="w-4 h-4" />, active: onInbox },
    { label: 'Comentários', href: `${base}/social/comentarios`, icon: <MessageSquareText className="w-4 h-4" />, active: onComentarios },
    { label: 'Automações', href: `${base}/social/automacoes`, icon: <Zap className="w-4 h-4" />, active: onAutomacoes },
  ]

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <nav className="flex gap-1" aria-label="Áreas do Instagram">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
              t.active
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.icon} {t.label}
          </Link>
        ))}
      </nav>
      {connected ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/${orgSlug}/configuracoes/social`}>
            Instagram conectado <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => { window.location.href = `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}` }}
        >
          Conectar Instagram
        </Button>
      )}
    </div>
  )
}
