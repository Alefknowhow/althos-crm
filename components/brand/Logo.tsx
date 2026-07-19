import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/constants/brand'

/**
 * Althos brand mark — official logo asset (white "A" glyph on a black
 * square). `gradient` is kept as a no-op prop so existing call sites don't
 * need to change.
 */
export function LogoMark({
  className,
}: {
  className?: string
  gradient?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt={`${BRAND.shortName} logo`}
      className={cn('h-7 w-7 shrink-0 rounded-md object-cover', className)}
    />
  )
}

/**
 * Full wordmark: brand mark + "Althos CRM" text.
 */
export function Logo({
  className,
  showText = true,
  textClassName,
}: {
  className?: string
  showText?: boolean
  textClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {showText && (
        <span
          className={cn(
            'font-semibold tracking-apple-tighter text-base text-foreground',
            textClassName,
          )}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  )
}
