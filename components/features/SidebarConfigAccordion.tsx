'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUB_ITEMS = [
  { seg: '',             label: 'Geral' },
  { seg: 'agente-ia',    label: 'Agente IA' },
  { seg: 'equipe',       label: 'Equipe' },
  { seg: 'notificacoes', label: 'Notificações' },
  { seg: 'aparencia',    label: 'Aparência' },
  { seg: 'seguranca',    label: 'Segurança' },
  { seg: 'integracoes',  label: 'Integrações' },
  { seg: 'agentes',      label: 'Conector MCP' },
] as const

/** Item "Configurações" da sidebar — expansível (acordeão), como no canvas
 *  do /design: a linha inteira é o gatilho que abre/fecha a lista de
 *  sub-abas (mesmo padrão de DOM que o CSS de rail colapsado já espera:
 *  `nav > div > button` pro gatilho, `nav > div > div` pro conteúdo que
 *  some quando a sidebar colapsa). Navegar acontece pelos sub-itens.
 *  Abre sozinho quando a rota atual já está dentro de /configuracoes. */
export default function SidebarConfigAccordion({ base }: { base: string }) {
  const pathname = usePathname()
  const settingsBase = `${base}/configuracoes`
  const withinSettings = pathname === settingsBase || pathname?.startsWith(settingsBase + '/')
  const [open, setOpen] = useState(withinSettings)

  // Segue a rota se o usuário navegar pra dentro/fora de Configurações por
  // outro caminho (ex.: link direto, botão "voltar").
  useEffect(() => { if (withinSettings) setOpen(true) }, [withinSettings])

  const activeSeg = withinSettings
    ? (pathname === settingsBase ? '' : (pathname ?? '').slice(settingsBase.length + 1).split('/')[0])
    : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          withinSettings ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Configurações</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {SUB_ITEMS.map(item => {
            const href = item.seg ? `${settingsBase}/${item.seg}` : settingsBase
            const isActive = activeSeg === item.seg
            return (
              <Link
                key={item.seg || 'geral'}
                href={href}
                className={cn(
                  'flex items-center mx-1 pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg transition-colors duration-100',
                  isActive
                    ? 'text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
