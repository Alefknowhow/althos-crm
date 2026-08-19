'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Navega pra Central de Ajuda (/ajuda, com todos os menus/categorias)
 * E abre o painel de chat de suporte ao mesmo tempo — o mesmo evento
 * que o antigo botão do header disparava (SupportWidget.tsx, montado
 * uma vez no layout, continua escutando normalmente na página nova).
 * Um clique cobre as duas necessidades: ler a documentação e já ter o
 * chat aberto pra perguntar algo específico.
 */
export default function SidebarSupportLink({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  const href = `/app/${orgSlug}/ajuda`
  const isActive = pathname === href || pathname?.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={() => window.dispatchEvent(new CustomEvent('althos:support-open'))}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-sm font-medium tracking-apple-snug rounded-none border-l-2 transition-colors duration-100',
        isActive
          ? 'border-primary bg-sidebar-accent/60 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40',
      )}
    >
      <HelpCircle className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span>Ajuda & Suporte</span>
    </Link>
  )
}
