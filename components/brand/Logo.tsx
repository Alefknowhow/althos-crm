import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/constants/brand'

/**
 * Althos brand mark — official logo asset (white "A" glyph on a black
 * square). `gradient` is kept as a no-op prop so existing call sites don't
 * need to change.
 *
 * `v2` opts into the new logo artwork (2026 refresh) via a separate file
 * (`/logo-mark-v2.png`) — the old `/logo-mark.png` is still shared with the
 * public marketing site (favicon, PWA icon, login/signup pages), which
 * isn't getting the new logo yet (full site redesign coming). App-only
 * surfaces (Sidebar, SupportWidget) pass `v2` to get the new mark without
 * touching the site.
 */
export function LogoMark({
  className,
  v2 = false,
}: {
  className?: string
  gradient?: boolean
  v2?: boolean
}) {
  return (
    <Image
      src={v2 ? '/logo-mark-v2.png' : '/logo-mark.png'}
      alt={`${BRAND.shortName} logo`}
      width={64}
      height={64}
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
  v2 = false,
}: {
  className?: string
  showText?: boolean
  textClassName?: string
  v2?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark v2={v2} />
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
