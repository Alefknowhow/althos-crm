'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'filled' | 'tonal' | 'outlined' | 'text'

/**
 * Botão M3 — cápsula, alvo mínimo 48px, sem glow/elevação (spec mobile G1).
 * Composição sobre classes utilitárias, não sobre components/ui/button.tsx
 * (esse primitive é compartilhado com o desktop e não deve ser editado).
 */
export const MobileButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant = 'filled', className, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 h-12 min-w-[48px] px-5 rounded-pill text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
    const variants: Record<Variant, string> = {
      filled: 'bg-m3-primary text-m3-on-primary hover:brightness-110',
      tonal: 'bg-m3-primary-container text-m3-on-primary-container hover:brightness-95',
      outlined: 'border border-m3-outline-variant text-m3-primary bg-transparent hover:bg-m3-surface-container',
      text: 'text-m3-primary bg-transparent hover:bg-m3-surface-container',
    }
    return (
      <button ref={ref} className={cn(base, variants[variant], className)} {...props}>
        {children}
      </button>
    )
  },
)
MobileButton.displayName = 'MobileButton'
