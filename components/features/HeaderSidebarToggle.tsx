'use client'

import { usePathname } from 'next/navigation'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { usePageHint } from './PageHintContext'
import { getPageTitle } from '@/lib/route-titles'

/** Nome da página atual + ícone (!) de ajuda, na primeira linha do conteúdo. */
export function HeaderSidebarToggle({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname, orgSlug)
  const { hint } = usePageHint()

  if (!title) return null

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <h1 className="text-base md:text-sm font-semibold tracking-apple-snug truncate">{title}</h1>
      {hint && (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="hidden md:inline-flex shrink-0 text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-0.5"
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
  )
}
