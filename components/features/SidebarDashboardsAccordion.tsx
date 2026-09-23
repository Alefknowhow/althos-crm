'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Item "Dashboards" da sidebar — expansível (acordeão), mesmo padrão do
 *  SidebarConfigAccordion. Substitui as abas horizontais que existiam
 *  dentro da própria página (issue #26): as visões do dashboard (Visão
 *  Geral/Pipeline/Vendas/Clientes/Equipe/nicho/WhatsApp) navegam por
 *  `?tab=` na mesma rota, então o item ativo é resolvido por query string,
 *  não por pathname. Abre sozinho quando a rota atual é a Inicial. */
export default function SidebarDashboardsAccordion({
  base, isClinic, hasClinica, hasImoveis, hasTrafego,
}: {
  base: string
  isClinic: boolean
  hasClinica: boolean
  hasImoveis: boolean
  hasTrafego: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isDashboardRoute = pathname === base
  const activeTab = isDashboardRoute ? (searchParams.get('tab') || 'visao-geral') : null

  const [open, setOpen] = useState(isDashboardRoute)
  useEffect(() => { if (isDashboardRoute) setOpen(true) }, [isDashboardRoute])

  const items = [
    { key: 'visao-geral', label: 'Visão Geral', href: base },
    { key: 'pipeline', label: 'Pipeline', href: `${base}?tab=pipeline` },
    ...(!isClinic ? [{ key: 'vendas', label: 'Vendas', href: `${base}?tab=vendas` }] : []),
    { key: 'clientes', label: isClinic ? 'Pacientes' : 'Clientes', href: `${base}?tab=clientes` },
    { key: 'equipe', label: 'Equipe', href: `${base}?tab=equipe` },
    ...(hasClinica ? [{ key: 'clinica', label: isClinic ? 'Atendimentos' : 'Clínica', href: `${base}?tab=clinica` }] : []),
    ...(hasImoveis ? [{ key: 'imoveis', label: 'Imobiliária', href: `${base}?tab=imoveis` }] : []),
    ...(hasTrafego ? [{ key: 'trafego', label: 'Tráfego', href: `${base}?tab=trafego` }] : []),
    { key: 'whatsapp', label: 'WhatsApp', href: `${base}?tab=whatsapp` },
  ]

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        data-tour="insights"
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          isDashboardRoute ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Dashboards</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map(item => {
            const isActive = activeTab === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex items-center mx-1 pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg transition-colors duration-100',
                  isActive ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
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
