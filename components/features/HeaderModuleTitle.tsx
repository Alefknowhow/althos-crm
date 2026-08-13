'use client'

import { usePathname } from 'next/navigation'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { usePageHint } from './PageHintContext'
import { getPageTitle } from '@/lib/route-titles'
import { PageIcon } from '@/lib/route-icons'

/** Título do módulo atual (desktop) — ícone em container arredondado +
 *  nome em destaque forte, como título principal da página. */
export function HeaderModuleTitle({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname ?? '', orgSlug)
  const { hint } = usePageHint()

  if (!title) return null

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
        <PageIcon orgSlug={orgSlug} className="w-[18px] h-[18px]" />
      </span>
      <h1 className="text-lg font-bold tracking-apple-snug truncate">{title}</h1>
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
  )
}
