'use client'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

/**
 * Bottom sheet M3 — cantos superiores 28px (spec mobile G1, 4.3). Composto
 * sobre o Sheet do shadcn (side="bottom"), não uma reimplementação —
 * herda foco contido/Escape/overlay já corretos do Radix.
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" data-mobile-shell className="font-mobile rounded-t-msheet bg-m3-surface-container-low border-m3-outline-variant max-h-[85vh] overflow-y-auto p-4">
        <VisuallyHidden asChild>
          <SheetTitle>{title}</SheetTitle>
        </VisuallyHidden>
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-m3-outline-variant" aria-hidden />
        {children}
      </SheetContent>
    </Sheet>
  )
}
