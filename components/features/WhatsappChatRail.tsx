'use client'

import Link from 'next/link'
import { Archive, CheckSquare, FileText, MessageCircle, MessageCircleMore, Pin } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { InboxView } from '@/lib/whatsapp/inbox-view'

const views = [
  { value: 'all', label: 'Conversas', icon: MessageCircle },
  { value: 'unread', label: 'Não lidas', icon: MessageCircleMore },
  { value: 'pinned', label: 'Fixadas', icon: Pin },
  { value: 'archived', label: 'Arquivadas', icon: Archive },
] as const

export default function WhatsappChatRail({ orgSlug, view, onViewChange, unreadCount, conversationOpen }: {
  orgSlug: string; view: InboxView; onViewChange: (view: InboxView) => void; unreadCount: number; conversationOpen: boolean
}) {
  const base = 'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
  return (
    <TooltipProvider delayDuration={150}>
      <nav aria-label="Ferramentas do WhatsApp" className={`${conversationOpen ? 'hidden md:flex' : 'flex'} w-14 md:w-16 shrink-0 flex-col items-center gap-3 border-r bg-muted/50 py-4`}>
        {views.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button type="button" aria-label={label} aria-pressed={view === value} onClick={() => onViewChange(value)} className={`${base} ${view === value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                <Icon className="h-5 w-5" />
                {value === 'unread' && unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
        <div className="mt-auto flex flex-col gap-3">
          {[{ href: 'tarefas', label: 'Tarefas', icon: CheckSquare }, { href: 'whatsapp-templates', label: 'Templates de mensagem', icon: FileText }].map(({ href, label, icon: Icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild><Link href={`/app/${orgSlug}/${href}`} aria-label={label} className={`${base} text-muted-foreground hover:bg-accent`}><Icon className="h-5 w-5" /></Link></TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </nav>
    </TooltipProvider>
  )
}
