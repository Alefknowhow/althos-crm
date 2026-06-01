import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/constants/brand'

/**
 * Althos brand mark — a stylized "A" formed by an upward chevron inside a
 * rounded-square tile. Uses `currentColor` so it inherits text color, with
 * an optional gradient fill for the hero/standalone treatment.
 */
export function LogoMark({
  className,
  gradient = true,
}: {
  className?: string
  gradient?: boolean
}) {
  const gid = 'althos-mark-grad'
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-7 w-7 shrink-0', className)}
      role="img"
      aria-label={`${BRAND.shortName} logo`}
    >
      {gradient && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
      )}
      <rect
        width="32"
        height="32"
        rx="8"
        fill={gradient ? `url(#${gid})` : 'currentColor'}
      />
      {/* Upward chevron "A" */}
      <path
        d="M16 8L23 23H19.2L16 15.6L12.8 23H9L16 8Z"
        fill="#ffffff"
      />
      <circle cx="16" cy="23" r="1.6" fill="#ffffff" />
    </svg>
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
