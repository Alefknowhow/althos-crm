'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Kanban, Users, CheckSquare, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  orgSlug: string
  showPipeline: boolean
  showContatos: boolean
  showTarefas: boolean
  showConversas: boolean
  overdueCount: number
  unreadCount: number
}

/**
 * Barra de navegação inferior mobile (design system) — 5 abas fixas.
 * Renderizada uma única vez (fora do children duplicado do SidebarShell),
 * reaproveita os mesmos checks de permissão já computados em Sidebar.tsx.
 */
export default function BottomNav({
  orgSlug, showPipeline, showContatos, showTarefas, showConversas, overdueCount, unreadCount,
}: BottomNavProps) {
  const pathname = usePathname()
  const base = `/app/${orgSlug}`

  const items = [
    { href: base, exact: true, label: 'Início', icon: LayoutDashboard, show: true },
    { href: `${base}/pipeline`, label: 'Pipeline', icon: Kanban, show: showPipeline },
    { href: `${base}/contatos`, label: 'Contatos', icon: Users, show: showContatos },
    { href: `${base}/tarefas`, label: 'Tarefas', icon: CheckSquare, show: showTarefas, badge: overdueCount > 0 ? 'error' : null },
    { href: `${base}/conversas`, label: 'Conversas', icon: MessageSquare, show: showConversas, badge: unreadCount > 0 ? 'success' : null },
  ].filter(i => i.show)

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(item => {
        const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0"
          >
            <span className="relative">
              <Icon
                className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')}
                strokeWidth={1.8}
              />
              {item.badge && (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full',
                    item.badge === 'error' ? 'bg-destructive' : 'bg-success'
                  )}
                />
              )}
            </span>
            <span className={cn('text-[10px] truncate', isActive ? 'text-primary font-semibold' : 'text-muted-foreground font-normal')}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
