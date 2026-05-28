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
        className="flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-lg text-muted-foreground/60 cursor-not-allowed"
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-lg transition-colors duration-150 ease-apple',
        isActive
          ? 'bg-sidebar-accent text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-tour={dataTour}
    >
      {children}
    </Link>
  )
}
