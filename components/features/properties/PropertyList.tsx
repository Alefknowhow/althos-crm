'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import type { PropertyRow } from '@/actions/properties'

type Member = { user_id: string; name: string; email: string }

const STATUS_LABELS: Record<string, string> = {
  disponivel: 'Disponível', reservado: 'Reservado', em_negociacao: 'Em negociação',
  vendido: 'Vendido', alugado: 'Alugado', indisponivel: 'Indisponível',
}
const STATUS_COLORS: Record<string, string> = {
  disponivel: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  reservado: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  em_negociacao: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  vendido: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  alugado: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  indisponivel: 'bg-muted text-muted-foreground hover:bg-muted',
}
const PURPOSE_LABELS: Record<string, string> = { venda: 'Venda', locacao: 'Locação', venda_locacao: 'Venda/Locação' }

export default function PropertyList({
  orgSlug, properties, members,
}: { orgSlug: string; properties: PropertyRow[]; members: Member[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [creating, setCreating] = useState(false)
  const memberName = useMemo(() => new Map(members.map(m => [m.user_id, m.name])), [members])

  const filtered = properties.filter(p => {
    if (status !== 'all' && p.status !== status) return false
    if (purpose !== 'all' && p.purpose !== purpose) return false
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      const haystack = [p.title, p.code, p.address_street, p.neighborhood, p.city].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Imóveis"
        hint="Cadastro de imóveis da agência."
        actions={
          <Button disabled={creating} onClick={() => { setCreating(true); router.push(`/app/${orgSlug}/imoveis/novo`) }}>
            {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />} Novo imóvel
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{properties.length} imóve{properties.length === 1 ? 'l' : 'is'} cadastrado{properties.length === 1 ? '' : 's'}</p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Código, título, bairro, cidade…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Finalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as finalidades</SelectItem>
            {Object.entries(PURPOSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Finalidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Nenhum imóvel encontrado.</TableCell></TableRow>
            )}
            {filtered.map(p => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/app/${orgSlug}/imoveis/${p.id}`)}>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{p.code}</TableCell>
                <TableCell className="min-w-[180px]">
                  <Link href={`/app/${orgSlug}/imoveis/${p.id}`} className="font-medium hover:underline" onClick={e => e.stopPropagation()}>{p.title || 'Sem título'}</Link>
                  {p.property_type && <p className="text-xs text-muted-foreground">{p.property_type}</p>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {[p.neighborhood, p.city].filter(Boolean).join(' · ') || '—'}
                </TableCell>
                <TableCell className="text-sm tabular-nums whitespace-nowrap">{p.price_cents != null ? formatCurrency(p.price_cents) : '—'}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{PURPOSE_LABELS[p.purpose]}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[p.status]} variant="secondary">{STATUS_LABELS[p.status]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{p.broker_user_id ? memberName.get(p.broker_user_id) || '—' : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
