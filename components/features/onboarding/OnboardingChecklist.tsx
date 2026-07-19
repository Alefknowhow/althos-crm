'use client'

/**
 * Getting-started checklist shown at the top of the org dashboard.
 *
 * The step states are DERIVED from real data (computed server-side in
 * OnboardingChecklistCard) — there is no separate "mark as done" write.
 * As the user actually does each thing (adds a lead, creates a form, etc.)
 * the corresponding row flips to done on the next render.
 *
 * Persistence: a single localStorage flag per org lets the user dismiss the
 * card. We also hide it automatically once every step is complete — its job
 * is over. Like the tour, dismissal is a pure UI affordance (no migration).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, X, Sparkles, PartyPopper } from 'lucide-react'

export interface ChecklistStep {
  id: string
  label: string
  description: string
  href: string
  done: boolean
}

export default function OnboardingChecklist({
  orgSlug,
  steps,
}: {
  orgSlug: string
  steps: ChecklistStep[]
}) {
  const storageKey = `althos.checklist.dismissed.${orgSlug}`
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  // Read dismissal flag after mount (SSR-safe).
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  const total = steps.length
  const completed = steps.filter(s => s.done).length
  const allDone = completed === total
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      /* privacy mode — ignore */
    }
    setDismissed(true)
  }

  // Avoid a flash before we know the dismissal state. Also hide once the
  // user dismissed or finished everything.
  if (dismissed === null) return null
  if (dismissed) return null
  if (allDone) {
    return (
      <div className="relative flex items-center gap-3 rounded-none border border-primary/20 bg-primary/5 px-4 py-3">
        <PartyPopper className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Tudo pronto! Você concluiu a configuração inicial.</p>
          <p className="text-xs text-muted-foreground">
            Seu CRM está com o essencial no lugar. Bom trabalho.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative rounded-none border border-border bg-card p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar checklist"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Primeiros passos</h2>
          <p className="text-xs text-muted-foreground">
            Complete a configuração para tirar o máximo do Althos.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            {completed} de {total} concluídos
          </span>
          <span className="tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="mt-4 divide-y divide-border/60">
        {steps.map(step => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-center gap-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground line-through">
                  {step.label}
                </span>
              </div>
            ) : (
              <Link
                href={step.href}
                className="group flex items-center gap-3 py-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 group-hover:border-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium group-hover:text-primary">
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
