'use client'

/**
 * Spotlight overlay + tooltip for OnboardingTour. Split out of
 * OnboardingTour.tsx.
 */

import { ArrowRight, ArrowLeft, Check, X } from 'lucide-react'

export type Step = {
  // CSS selector. We use data-tour="<id>" attributes on anchor elements
  // so the tour stays decoupled from class names that might change.
  selector: string
  title: string
  body: string
  // Where to place the tooltip relative to the target. "auto" picks the
  // best side based on available viewport space.
  side?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
}

export function SpotlightOverlay({
  rect,
  step,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: DOMRect | null
  step: Step
  index: number
  total: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  // If the target is missing (e.g. element hidden on mobile), fall back to
  // a centered tooltip — better to show the explanation than skip silently.
  if (!rect) {
    return (
      <div className="fixed inset-0 z-[100]">
        <div className="absolute inset-0 bg-black/55" />
        <TourTooltip
          step={step}
          index={index}
          total={total}
          onNext={onNext}
          onPrev={onPrev}
          onSkip={onSkip}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    )
  }

  const pad = 8
  const r = {
    top: Math.max(0, rect.top - pad),
    left: Math.max(0, rect.left - pad),
    right: Math.min(window.innerWidth, rect.right + pad),
    bottom: Math.min(window.innerHeight, rect.bottom + pad),
  }
  const w = r.right - r.left
  const h = r.bottom - r.top

  // Pick side based on available space. "right" preferred on desktop
  // (sidebar items are on the left). Falls back to bottom on mobile.
  const desired = step.side || 'auto'
  const spaceRight = window.innerWidth - r.right
  const spaceBelow = window.innerHeight - r.bottom
  const computedSide =
    desired === 'auto'
      ? spaceRight > 320
        ? 'right'
        : spaceBelow > 220
          ? 'bottom'
          : 'top'
      : desired

  // Tooltip placement coords.
  const tooltipStyle: React.CSSProperties = (() => {
    const gap = 14
    const tw = 320
    const th = 180
    switch (computedSide) {
      case 'right':
        return {
          position: 'fixed',
          top: Math.min(window.innerHeight - th - 12, Math.max(12, r.top)),
          left: Math.min(window.innerWidth - tw - 12, r.right + gap),
        }
      case 'left':
        return {
          position: 'fixed',
          top: Math.min(window.innerHeight - th - 12, Math.max(12, r.top)),
          left: Math.max(12, r.left - gap - tw),
        }
      case 'top':
        return {
          position: 'fixed',
          top: Math.max(12, r.top - gap - th),
          left: Math.min(window.innerWidth - tw - 12, Math.max(12, r.left)),
        }
      case 'bottom':
      default:
        return {
          position: 'fixed',
          top: Math.min(window.innerHeight - th - 12, r.bottom + gap),
          left: Math.min(window.innerWidth - tw - 12, Math.max(12, r.left)),
        }
    }
  })()

  const dim = 'fixed bg-black/55 transition-all duration-200 ease-out'

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Four dim panels — top, bottom, left, right of the cutout rect. */}
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: r.top }} />
      <div className={dim} style={{ top: r.bottom, left: 0, right: 0, bottom: 0 }} />
      <div className={dim} style={{ top: r.top, left: 0, width: r.left, height: h }} />
      <div className={dim} style={{ top: r.top, left: r.right, right: 0, height: h }} />

      {/* Highlight ring around the target. pointer-events-none so the
          user can still click the target if they want. */}
      <div
        className="fixed pointer-events-none rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-200 ease-out"
        style={{ top: r.top, left: r.left, width: w, height: h }}
      />

      <TourTooltip
        step={step}
        index={index}
        total={total}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        style={tooltipStyle}
      />
    </div>
  )
}

function TourTooltip({
  step,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
  style,
}: {
  step: Step
  index: number
  total: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  style: React.CSSProperties
}) {
  const isLast = index + 1 === total
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="w-[320px] bg-card border border-border rounded-none   p-4 animate-in fade-in slide-in-from-left-1 duration-150"
      style={style}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Passo {index + 1} de {total}
        </span>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Pular tour"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{step.title}</h3>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step.body}</p>
      <div className="flex items-center justify-between gap-2 mt-4">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Pular
        </button>
        <div className="flex items-center gap-1.5">
          {index > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="h-8 px-2.5 text-xs rounded-md hover:bg-muted text-muted-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="h-8 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1"
          >
            {isLast ? (
              <>
                Concluir
                <Check className="w-3 h-3" />
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
