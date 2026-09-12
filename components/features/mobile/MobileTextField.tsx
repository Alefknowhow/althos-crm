'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Campo M3 — altura 56px, label persistente (nunca só placeholder), ajuda/
 * erro associados ao input (spec mobile G1, 4.5). Composição sobre um
 * `<input>` nativo — components/ui/input.tsx (estilo Carbon) não é editado.
 */
export function MobileTextField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const autoId = useId()
  const inputId = id || autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-m3-on-surface-variant">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(
          'w-full h-14 rounded-mfield border px-4 text-base text-m3-on-surface bg-m3-surface-container-low placeholder:text-m3-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-m3-primary',
          error ? 'border-destructive' : 'border-m3-outline-variant',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-m3-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  )
}
