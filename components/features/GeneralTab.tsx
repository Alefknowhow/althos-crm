'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NICHE_OPTIONS } from '@/lib/niche'
import { updateOrgNiche } from '@/actions/organization'
import { Loader2 } from 'lucide-react'

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
          Escolher <span className="font-medium">Agência de Viagens</span> libera as abas de Cotações e Reservas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label className="sr-only">Nicho</Label>
        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o nicho" />
          </SelectTrigger>
          <SelectContent>
            {NICHE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
