'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  ChevronDown, Phone, PhoneCall, Bot, BarChart3, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SUB_ITEMS = [
  { seg: '',           label: 'Visão geral',      icon: Phone },
  { seg: 'interacoes', label: 'Chamadas & SMS',   icon: PhoneCall },
  { seg: 'agentes',    label: 'Agentes de IA',    icon: Bot },
  { seg: 'analytics',  label: 'Analytics & Equipe', icon: BarChart3 },
  { seg: 'conta',      label: 'Conta',            icon: Wallet },
] as const

/** Item "Voice" da sidebar — expansível (acordeão), mesmo padrão de
 *  SidebarConfigAccordion.tsx: a linha inteira é o gatilho que abre/fecha a
 *  lista de sub-seções (antes abas horizontais em VoiceTabsNav.tsx, agora
 *  eliminadas — a navegação entre seções acontece só pelos sub-itens
 *  daqui). Abre sozinho quando a rota atual já está dentro de /voice. */
export default function SidebarVoiceAccordion({ base }: { base: string }) {
  const pathname = usePathname()
  const voiceBase = `${base}/voice`
  const withinVoice = pathname === voiceBase || pathname?.startsWith(voiceBase + '/')
  const [open, setOpen] = useState(withinVoice)

  // Segue a rota se o usuário navegar pra dentro/fora de Voice por outro
  // caminho (ex.: link direto, botão "voltar").
  useEffect(() => { if (withinVoice) setOpen(true) }, [withinVoice])

  const activeSeg = withinVoice
    ? (pathname === voiceBase ? '' : (pathname ?? '').slice(voiceBase.length + 1).split('/')[0])
    : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          withinVoice ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Phone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Voice</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {SUB_ITEMS.map(item => {
            const href = item.seg ? `${voiceBase}/${item.seg}` : voiceBase
            const isActive = activeSeg === item.seg
            const Icon = item.icon
            return (
              <Link
                key={item.seg || 'geral'}
                href={href}
                className={cn(
                  'flex items-center gap-2 mx-1 pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg transition-colors duration-100',
                  isActive
                    ? 'text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
