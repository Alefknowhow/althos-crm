'use client'

import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"

interface HelpTooltipProps {
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function HelpTooltip({ content, side = 'top' }: HelpTooltipProps) {
  // Toggle por clique: abre ao clicar e só fecha ao clicar de novo (ou fora).
  // No mobile o comportamento de hover fazia a dica sumir rápido demais;
  // aqui ignoramos a abertura por hover e controlamos pelo clique.
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipProvider>
      <Tooltip
        open={open}
        onOpenChange={(o) => { if (!o) setOpen(false) }}
        delayDuration={0}
        disableHoverableContent
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-0.5"
            aria-label={`Ajuda: ${content}`}
            aria-expanded={open}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[250px] text-xs leading-relaxed"
          onPointerDownOutside={() => setOpen(false)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
