'use client'

import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Page title rendered as an h1. */
  title: string
  /** Optional hint shown on hover via an info (circle-i) icon next to the title. */
  hint?: string
  /** Optional actions rendered on the right side of the header row. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Standard page header for the CRM. Renders the title with an optional info
 * icon (circle with an "i") whose tooltip carries the page description — this
 * replaces the muted subtitle paragraphs to reclaim vertical space.
 */
export function PageHeader({ title, hint, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {hint && (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-0.5"
                  aria-label={hint}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[320px] text-xs leading-relaxed font-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
