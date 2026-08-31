'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { listContatoDeals, type ContatoDeal } from '@/actions/contatos'
import { DealCard } from '@/components/features/contatos/ContatosView'

function fmtCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
function fmtDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}

export default function LeadDealsTab({ orgSlug, leadId }: { orgSlug: string; leadId: string }) {
  const [deals, setDeals] = useState<ContatoDeal[] | null>(null)

  useEffect(() => {
    let active = true
    setDeals(null)
    listContatoDeals(orgSlug, leadId).then(d => { if (active) setDeals(d) })
    return () => { active = false }
  }, [orgSlug, leadId])

  if (deals === null) {
    return <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
  }

  if (deals.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma negociação registrada.</p>
  }

  return (
    <div className="space-y-2">
      {deals.map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
    </div>
  )
}
