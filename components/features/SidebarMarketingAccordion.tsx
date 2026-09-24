'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDown, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKETING_SUB_ITEMS as SUB_ITEMS } from '@/lib/route-titles'

/** Item "Anúncios" da sidebar — expansível (acordeão), mesmo padrão do
 *  SidebarConfigAccordion. Reestrutura o módulo em Visão Geral / Meta Ads /
 *  Google Ads (issue #24) — abre sozinho quando a rota atual já está dentro
 *  de /marketing (inclui /marketing/contas e /marketing/importar, que não
 *  têm sub-item próprio mas continuam parte do módulo). */
export default function SidebarMarketingAccordion({ base }: { base: string }) {
  const pathname = usePathname()
  const marketingBase = `${base}/marketing`
  const withinMarketing = pathname === marketingBase || pathname?.startsWith(marketingBase + '/')
  const [open, setOpen] = useState(withinMarketing)

  useEffect(() => { if (withinMarketing) setOpen(true) }, [withinMarketing])

  const activeSeg = withinMarketing
    ? (pathname === marketingBase ? '' : (pathname ?? '').slice(marketingBase.length + 1).split('/')[0])
    : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        data-tour="forms"
        className={cn(
          'w-full flex items-center justify-between mx-1 px-3 py-2 rounded-lg text-sm font-medium tracking-apple-snug transition-colors duration-100',
          withinMarketing ? 'bg-primary/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Megaphone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">Anúncios</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {SUB_ITEMS.map(item => {
            const href = item.seg ? `${marketingBase}/${item.seg}` : marketingBase
            const isActive = activeSeg === item.seg
            return (
              <Link
                key={item.seg || 'visao-geral'}
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
