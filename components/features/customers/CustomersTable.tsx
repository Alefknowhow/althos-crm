'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, MapPin, FileCheck2, ExternalLink, Mail, Phone } from 'lucide-react'
import type { CustomerListRow } from '@/actions/contatos'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

export default function CustomersTable({
  orgSlug,
  customers,
}: {
  orgSlug: string
  customers: CustomerListRow[]
}) {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [hasDocsOnly, setHasDocsOnly] = useState(false)

  const states = useMemo(() => {
    const set = new Set<string>()
    for (const c of customers) if (c.state) set.add(c.state)
    return Array.from(set).sort()
  }, [customers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return customers.filter(c => {
      if (q) {
        const hay = [c.name, c.email, c.phone, c.city, c.state].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (stateFilter && c.state !== stateFilter) return false
      if (hasDocsOnly && !c.has_documents) return false
      return true
    })
  }, [customers, search, stateFilter, hasDocsOnly])

  const totalRevenue = filtered.reduce((a, c) => a + c.total_purchased_cents, 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, e-mail, telefone, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
        >
          <option value="">Todos os estados</option>
          {states.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={hasDocsOnly}
            onChange={e => setHasDocsOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-primary"
          />
          Apenas com documentos
        </label>

        <div className="flex-1" />

        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground tabular-nums">{filtered.length}</strong> cliente(s) ·
          faturado total: <strong className="text-foreground tabular-nums">{fmtCurrency(totalRevenue)}</strong>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente corresponde aos filtros.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Contato</TableHead>
                    <TableHead className="hidden lg:table-cell">Localização</TableHead>
                    <TableHead className="text-right">Total comprado</TableHead>
                    <TableHead className="hidden md:table-cell">Última compra</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Docs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/app/${orgSlug}/contatos/${c.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.became_customer_at && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            cliente desde {new Date(c.became_customer_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.email && (
                          <div className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="text-xs flex items-center gap-1 text-muted-foreground mt-0.5">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </div>
                        )}
                        {!c.email && !c.phone && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {c.city || c.state ? (
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {[c.city, c.state].filter(Boolean).join(' · ')}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        {fmtCurrency(c.total_purchased_cents)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                        {c.last_purchase_at
                          ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        {c.has_documents ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                            <FileCheck2 className="w-3 h-3 mr-1" /> OK
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/app/${orgSlug}/contatos/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Abrir <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
