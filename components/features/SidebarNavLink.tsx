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
        // Item ativo vira pílula tintada (padrão iOS Settings) em vez da
        // régua de 2px na borda esquerda — mais "objeto de app", menos
        // side-nav de ferramenta corporativa.
        'flex items-center justify-between mx-1 px-3 py-2 text-sm font-medium tracking-apple-snug rounded-lg border-l-2 border-transparent transition-colors duration-100',
        isActive
          ? 'bg-primary/12 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-tour={dataTour}
    >
      {children}
    </Link>
  )
}
