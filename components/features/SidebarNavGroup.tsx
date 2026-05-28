'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface SubItem {
  name: string
  href: string
  /** Match only the exact path (no startsWith). Good for "Geral" / index pages. */
  exact?: boolean
}

interface SidebarNavGroupProps {
  label: string
  /** Pass a pre-rendered icon node, e.g. <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />.
   *  We cannot pass the icon *component* (a function) from a Server Component
   *  to a Client Component — Next.js forbids it. */
  icon: ReactNode
  items: SubItem[]
  dataTour?: string
}

function isItemActive(pathname: string, item: SubItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function SidebarNavGroup({
  label,
  icon,
  items,
  dataTour,
}: SidebarNavGroupProps) {
  const pathname = usePathname()
  const isAnyChildActive = items.some(item => isItemActive(pathname, item))

  // Start expanded if a child is active; otherwise collapsed.
  const [open, setOpen] = useState(isAnyChildActive)

  // Re-sync whenever the route changes (e.g. user navigates via <Link>).
  useEffect(() => {
    if (isAnyChildActive) setOpen(true)
  }, [isAnyChildActive])

  return (
    <div>
      {/* Parent trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        data-tour={dataTour}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-lg transition-colors duration-150 ease-apple',
          isAnyChildActive
            ? 'bg-sidebar-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
        )}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          {icon}
          <span>{label}</span>
        </span>
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
            open ? 'rotate-90' : 'rotate-0'
          )}
          strokeWidth={2}
        />
      </button>

      {/* Sub-items */}
      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
          {items.map(item => {
            const active = isItemActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors duration-150 ease-apple',
                  active
                    ? 'text-foreground font-medium bg-sidebar-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
