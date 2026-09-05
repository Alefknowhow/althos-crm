'use client'

/**
 * "Consumo" tab (supply consumption backlog with filters) for
 * EstoqueClient. Split out of EstoqueClient.tsx.
 */

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { ClinicSupplyConsumptionRow } from '@/actions/clinic-estoque'
import type { ClinicProfessional } from '@/actions/clinic'

function formatDateTimeBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ConsumoTab({ orgSlug: _orgSlug, initialConsumption, professionals }: {
  orgSlug: string
  initialConsumption: ClinicSupplyConsumptionRow[]
  professionals: ClinicProfessional[]
}) {
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [professionalId, setProfessionalId] = useState('')

  const filtered = useMemo(() => {
    let rows = initialConsumption
    if (from) rows = rows.filter(r => r.consumed_at.slice(0, 10) >= from)
    if (to) rows = rows.filter(r => r.consumed_at.slice(0, 10) <= to)
    if (professionalId) rows = rows.filter(r => r.professional_id === professionalId)
    const term = search.trim().toLowerCase()
    if (term) rows = rows.filter(r =>
      r.supply_name.toLowerCase().includes(term) ||
      (r.professional_name || '').toLowerCase().includes(term) ||
      (r.patient_name || '').toLowerCase().includes(term)
    )
    return rows
  }, [initialConsumption, search, from, to, professionalId])

  const sourceLabel: Record<string, string> = { atendimento: 'Atendimento', manual: 'Manual', ajuste: 'Ajuste' }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Insumo, profissional, paciente..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Profissional</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={professionalId} onChange={e => setProfessionalId(e.target.value)}>
            <option value="">Todos</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data/hora</th>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-right font-medium px-3 py-2">Quantidade</th>
              <th className="text-left font-medium px-3 py-2">Profissional</th>
              <th className="text-left font-medium px-3 py-2">Paciente</th>
              <th className="text-left font-medium px-3 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{formatDateTimeBR(r.consumed_at)}</td>
                <td className="px-3 py-2 font-medium">{r.supply_name}</td>
                <td className="px-3 py-2 text-right">{r.quantity} {r.unit}</td>
                <td className="px-3 py-2">{r.professional_name || '—'}</td>
                <td className="px-3 py-2">{r.patient_name || '—'}</td>
                <td className="px-3 py-2"><Badge variant="outline">{sourceLabel[r.source] || r.source}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum consumo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
