'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Botão de ícone M3 — alvo 48×48 CSS px inteiro é interativo (não só o
 * ícone de 24px dentro dele), corrigindo os alvos de 24–32px encontrados
 * no diagnóstico (Pipeline, Seguros, Visitas, Bloqueios, Retornos).
 */
export const MobileIconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center h-12 w-12 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container disabled:opacity-50 disabled:pointer-events-none transition-colors',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
MobileIconButton.displayName = 'MobileIconButton'
