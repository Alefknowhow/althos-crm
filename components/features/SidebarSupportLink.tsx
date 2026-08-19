'use client'

import { HelpCircle } from 'lucide-react'

/**
 * Abre o painel de suporte (SupportWidget.tsx, montado uma vez no
 * layout) via o mesmo evento que o antigo botão do header disparava —
 * ver components/features/SupportWidget.tsx::SupportHeaderButton
 * (removido do header, essa é a nova localização, na sidebar).
 */
export default function SidebarSupportLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('althos:support-open'))}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium tracking-apple-snug rounded-none border-l-2 border-transparent text-muted-foreground transition-colors duration-100 hover:text-foreground hover:bg-sidebar-accent/40"
    >
      <HelpCircle className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span>Ajuda & Suporte</span>
    </button>
  )
}
