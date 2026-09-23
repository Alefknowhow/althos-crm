'use client'

import { usePathname } from 'next/navigation'
import { getPageTitle, getRouteSegment, getConfigSubLabel } from '@/lib/route-titles'

/** Breadcrumb do módulo/rota atual, no topo da sidebar (acima do seletor de
 *  organização) — ex.: "configurações/geral", "configurações/agente ia". */
export function SidebarRouteBreadcrumb({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? ''
  const title = getPageTitle(pathname, orgSlug)
  if (!title) return null

  const seg1 = getRouteSegment(pathname, orgSlug)
  const prefix = `/app/${orgSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const seg2 = rest.split('/').filter(Boolean)[1] ?? ''
  const subLabel = seg1 === 'configuracoes' ? getConfigSubLabel(seg2) : null

  const crumb = subLabel ? `${title}/${subLabel}` : title

  return (
    <p className="px-2 pb-1.5 text-[11px] font-medium text-sidebar-foreground/45 truncate lowercase">
      {crumb}
    </p>
  )
}
