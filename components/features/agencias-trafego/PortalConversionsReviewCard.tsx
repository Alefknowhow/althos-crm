'use client'

/**
 * Card "Conversões informadas pelo cliente" (#27/#61 2.5) — mostra as
 * portal_conversions deste cliente pro gestor confirmar ("Validar") antes
 * de entrarem em relatórios; validar uma venda dispara Purchase via CAPI
 * (server-side, ver actions/portal-conversions-review.ts).
 */

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { validatePortalConversion, type ClientPortalConversion } from '@/actions/portal-conversions-review'

const TYPE_LABEL: Record<string, string> = {
  lead: 'Lead', qualificado: 'Qualificado', agendamento: 'Agendamento', venda: 'Venda', perdido: 'Perdido',
}

export default function PortalConversionsReviewCard({
  orgSlug, clientId, initial,
}: {
  orgSlug: string
  clientId: string
  initial: ClientPortalConversion[]
}) {
  const [conversions, setConversions] = useState(initial)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (conversions.length === 0) return null

  function handleValidate(id: string) {
    setValidatingId(id)
    startTransition(async () => {
      const res = await validatePortalConversion(orgSlug, clientId, id)
      if (res.ok) {
        setConversions(prev => prev.map(c => c.id === id ? { ...c, validatedAt: new Date().toISOString() } : c))
      }
      setValidatingId(null)
    })
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Conversões informadas pelo cliente</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {conversions.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{TYPE_LABEL[c.type] || c.type}</Badge>
                <span className="text-muted-foreground text-xs">{new Date(c.occurredAt + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                {c.valueCents != null && <span className="font-medium">{formatCurrency(c.valueCents)}</span>}
              </div>
              {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
            </div>
            {c.validatedAt ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Validada</span>
            ) : (
              <Button size="sm" variant="outline" disabled={validatingId === c.id} onClick={() => handleValidate(c.id)}>
                {validatingId === c.id ? 'Validando…' : 'Validar'}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
