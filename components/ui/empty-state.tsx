import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  // When the caller passes a custom CTA (e.g., a dialog trigger), it goes here
  // and overrides the actionLabel/actionHref link button.
  children?: ReactNode
}

/**
 * Polished empty state — a soft radial backdrop + ringed icon to make
 * a blank page feel intentional rather than broken. API-compatible with
 * the old version: existing call sites need no changes.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  children,
}: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center p-8 text-center bg-background rounded-xl border border-dashed py-16">
      {/* Soft radial glow behind the icon — gives depth without art assets. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center top, hsl(var(--primary) / 0.08), transparent 60%)',
        }}
      />

      {/* Icon medallion: ringed badge with a faint inner glow. */}
      <div className="relative mb-5">
        <div
          aria-hidden="true"
          className="absolute inset-0 -m-1 rounded-full bg-primary/10 blur-md"
        />
        <div className="relative w-14 h-14 rounded-full bg-muted/60 ring-1 ring-border flex items-center justify-center">
          <Icon className="w-6 h-6 text-foreground/70" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1.5 leading-relaxed">
        {description}
      </p>
      {children
        ? <div className="mt-6">{children}</div>
        : actionLabel && actionHref && (
            <Button asChild className="mt-6">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          )}
    </div>
  )
}
