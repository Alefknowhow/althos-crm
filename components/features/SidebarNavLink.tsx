'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface SidebarNavLinkProps {
  href: string
  exact?: boolean
  disabled?: boolean
  children: ReactNode
  // Optional onboarding-tour anchor — set so OnboardingTour can find this
  // nav row via document.querySelector('[data-tour="..."]').
  dataTour?: string
}

export default function SidebarNavLink({ href, exact = false, disabled = false, children, dataTour }: SidebarNavLinkProps) {
  const pathname = usePathname()
  const isActive = !disabled && (exact ? pathname === href : pathname === href || pathname.startsWith(href + '/'))

  if (disabled) {
    return (
      <span
        aria-disabled
        className="flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-none border-l-2 border-transparent text-muted-foreground/60 cursor-not-allowed"
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        // Carbon side-nav: active state is a 2px blue rule on the leading
        // edge (the vertical-list analog of an underline), not a filled pill.
        'flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-none border-l-2 transition-colors duration-100',
        isActive
          ? 'border-primary bg-sidebar-accent/60 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-tour={dataTour}
    >
      {children}
    </Link>
  )
}
