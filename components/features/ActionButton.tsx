'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ActionButtonProps extends ButtonProps {
  pending?: boolean
  pendingLabel?: string
}

const tones = {
  default: 'border border-[hsl(var(--action-primary))] bg-[hsl(var(--action-primary))] text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.15),0_1px_2px_hsl(var(--foreground)/0.1)] hover:bg-[hsl(var(--action-primary-hover))] hover:translate-y-0 active:bg-[hsl(var(--action-primary-active))] active:shadow-inner',
  outline: 'border border-border bg-card text-card-foreground shadow-sm hover:bg-secondary',
  secondary: 'border border-border bg-secondary text-secondary-foreground shadow-none hover:bg-accent',
  ghost: 'border border-transparent shadow-none hover:bg-secondary',
  destructive: 'border border-transparent shadow-sm',
  success: 'border border-transparent shadow-sm',
  link: 'border-0 shadow-none',
}

const sizes = {
  default: 'h-9 px-3 py-2',
  sm: 'h-8 px-2.5 py-1.5',
  lg: 'h-10 px-4 py-2',
  icon: 'h-9 w-9 p-0',
  pill: 'h-9 px-4 py-2',
}

function PendingContent({ pending, label, children }: { pending: boolean; label: string; children: React.ReactNode }) {
  return (
    <span className="inline-grid items-center justify-items-center" aria-live="polite">
      <span className={cn('col-start-1 row-start-1 inline-flex items-center gap-1.5', pending && 'invisible')} aria-hidden={pending || undefined}>{children}</span>
      <span className={cn('col-start-1 row-start-1 inline-flex items-center gap-1.5', !pending && 'invisible')} aria-hidden={!pending || undefined}>
        <Loader2 className={cn('h-4 w-4', pending && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
        {label}
      </span>
    </span>
  )
}

/** CRM action styling composed over the generated UI primitive. */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant = 'default', size = 'default', pending, pendingLabel = 'Salvando…', disabled, children, asChild, ...props }, ref) => (
    <Button
      {...props}
      ref={ref}
      asChild={asChild}
      variant={variant}
      size={size}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        'gap-1.5 rounded-[8px] text-[13px] tracking-normal transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none focus-visible:ring-[hsl(var(--action-primary))] disabled:shadow-none [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11',
        tones[variant ?? 'default'], sizes[size ?? 'default'], className,
      )}
    >
      {asChild ? children : (
        pending !== undefined ? (
          <PendingContent pending={pending} label={pendingLabel}>{children}</PendingContent>
        ) : children
      )}
    </Button>
  ),
)
ActionButton.displayName = 'ActionButton'
