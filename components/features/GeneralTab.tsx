'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NICHE_OPTIONS, isTravelNiche } from '@/lib/niche'
import { updateOrgNiche } from '@/actions/organization'
import { Check, Loader2, PlaneTakeoff } from 'lucide-react'

interface Props {
  orgSlug:      string
  initialNiche: string
}

/**
 * Geral tab — account-level settings. The niche is a property of the Conta and
 * applies to every organization. Per-organization details (name, company data,
 * member access) live in the Organizações tab.
 */
export default function GeneralTab({ orgSlug, initialNiche }: Props) {
  const [niche, setNiche]   = useState(initialNiche)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [pending, start]    = useTransition()

  const dirty = niche !== initialNiche

  function save() {
    setError(null)
    setSaved(false)
    start(async () => {
      const res = await updateOrgNiche(orgSlug, niche)
      if (res.ok) {
        setSaved(true)
        // Reload so niche-gated sidebar links + pages reflect the change.
        setTimeout(() => window.location.reload(), 600)
      } else {
        setError(res.error || 'Não foi possível salvar.')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nicho da Conta</CardTitle>
        <CardDescription>
          O nicho vale para <span className="font-medium">toda a Conta</span> — todas as organizações herdam o mesmo.
          Escolher <span className="font-medium">Agência de Viagens</span> libera as abas de Propostas e Vendas Viagem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label className="sr-only">Nicho</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NICHE_OPTIONS.map(opt => {
            const active = niche === opt.value
            const travel = isTravelNiche(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNiche(opt.value)}
                className={cn(
                  'relative h-16 rounded-xl border-2 text-sm font-medium transition-all duration-150 px-3 flex items-center justify-center gap-2 text-center',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40 text-foreground',
                )}
              >
                {travel && <PlaneTakeoff className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
                <span>{opt.label}</span>
                {active && <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5" />}
              </button>
            )
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-green-600 dark:text-green-400">Nicho atualizado! Recarregando…</p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar Alterações
        </Button>
      </CardFooter>
    </Card>
  )
}
