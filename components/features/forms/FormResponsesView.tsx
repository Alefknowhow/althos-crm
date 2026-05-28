'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Filter, X, ExternalLink, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

type FormField = {
  id: string
  label: string
  type: string
  options?: string[]
}

type Lead = { id: string; name: string | null; email: string | null; phone: string | null } | null

type Submission = {
  id: string
  created_at: string
  data: Record<string, any> | null
  meta: Record<string, any> | null
  lead_id: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  leads: Lead | Lead[] | null
}

type Props = {
  orgSlug: string
  form: { id: string; name: string; schema: { fields: FormField[] } }
  submissions: Submission[]
  total: number
  page: number
  pageSize: number
  filters: {
    from?: string
    to?: string
    utmSource?: string
    utmCampaign?: string
  }
}

function pickLead(s: Submission): Lead {
  if (Array.isArray(s.leads)) return s.leads[0] || null
  return s.leads as Lead
}

function renderCell(field: FormField, value: any): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export default function FormResponsesView({
  orgSlug,
  form,
  submissions,
  total,
  page,
  pageSize,
  filters,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Submission | null>(null)
  const [search, setSearch] = useState('')

  const [draft, setDraft] = useState({
    from: filters.from || '',
    to: filters.to || '',
    utmSource: filters.utmSource || '',
    utmCampaign: filters.utmCampaign || '',
  })

  const fields = form.schema?.fields || []
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function buildUrl(updates: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === undefined) params.delete(k)
      else params.set(k, String(v))
    }
    return `${pathname}?${params.toString()}`
  }

  function applyFilters() {
    startTransition(() => {
      router.push(
        buildUrl({
          from: draft.from || null,
          to: draft.to || null,
          utm_source: draft.utmSource || null,
          utm_campaign: draft.utmCampaign || null,
          page: 0,
        }),
      )
    })
  }

  function clearFilters() {
    setDraft({ from: '', to: '', utmSource: '', utmCampaign: '' })
    startTransition(() => {
      router.push(pathname || '')
    })
  }

  function goPage(next: number) {
    startTransition(() => {
      router.push(buildUrl({ page: next }))
    })
  }

  // Client-side free text search (within current page)
  const visible = submissions.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const lead = pickLead(s)
    const haystack = [
      lead?.name,
      lead?.email,
      lead?.phone,
      JSON.stringify(s.data || {}),
      JSON.stringify(s.meta || {}),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })

  const selectedLead = selected ? pickLead(selected) : null
  const hasActiveFilters = !!(filters.from || filters.to || filters.utmSource || filters.utmCampaign)

  return (
    <div className="p-6 space-y-4">
      {/* Filter bar */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={draft.from}
              onChange={e => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={draft.to}
              onChange={e => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UTM Source</Label>
            <Input
              placeholder="ex: facebook"
              value={draft.utmSource}
              onChange={e => setDraft({ ...draft, utmSource: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UTM Campaign</Label>
            <Input
              placeholder="ex: black-friday"
              value={draft.utmCampaign}
              onChange={e => setDraft({ ...draft, utmCampaign: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} disabled={isPending} className="flex-1">
              {isPending ? 'Filtrando...' : 'Aplicar'}
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} disabled={isPending}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nesta página (nome, e-mail, resposta...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">
              {total === 0 ? 'Nenhuma resposta ainda' : 'Nenhuma resposta corresponde aos filtros'}
            </p>
            <p className="text-sm">
              {total === 0
                ? 'Compartilhe o link do formulário para começar a coletar respostas.'
                : 'Ajuste os filtros ou a busca acima.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead className="whitespace-nowrap">Lead</TableHead>
                  <TableHead className="whitespace-nowrap">UTM Source</TableHead>
                  <TableHead className="whitespace-nowrap">UTM Campaign</TableHead>
                  {fields.map(f => (
                    <TableHead key={f.id} className="whitespace-nowrap">
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(s => {
                  const lead = pickLead(s)
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(s)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(s.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lead ? (
                          <div>
                            <div className="font-medium text-sm">{lead.name || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {lead.email || lead.phone || ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {(s.utm_source ?? s.meta?.utm_source) ? (
                          <Badge variant="secondary">{s.utm_source ?? s.meta?.utm_source}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {(s.utm_campaign ?? s.meta?.utm_campaign) ? (
                          <Badge variant="outline">{s.utm_campaign ?? s.meta?.utm_campaign}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {fields.map(f => (
                        <TableCell key={f.id} className="text-sm max-w-xs truncate">
                          {renderCell(f, s.data?.[f.id])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total} respostas
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0 || isPending}
              onClick={() => goPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || isPending}
              onClick={() => goPage(page + 1)}
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Resposta de {pickLead(selected)?.name || 'Lead'}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString('pt-BR')}
                </p>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Lead info */}
                {selectedLead && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Lead
                    </h3>
                    <div className="border rounded-lg p-3 space-y-1 text-sm bg-muted/20">
                      <div>
                        <strong>Nome:</strong> {selectedLead.name || '—'}
                      </div>
                      <div>
                        <strong>E-mail:</strong> {selectedLead.email || '—'}
                      </div>
                      <div>
                        <strong>Telefone:</strong> {selectedLead.phone || '—'}
                      </div>
                      {selectedLead.id && (
                        <Link
                          href={`/app/${orgSlug}/leads/${selectedLead.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1"
                        >
                          Abrir lead <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </section>
                )}

                {/* Answers */}
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Respostas
                  </h3>
                  <div className="border rounded-lg divide-y">
                    {fields.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Sem campos definidos.</p>
                    ) : (
                      fields.map(f => (
                        <div key={f.id} className="p-3 text-sm">
                          <div className="text-xs text-muted-foreground">{f.label}</div>
                          <div className="font-medium break-words">
                            {renderCell(f, selected.data?.[f.id])}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Meta */}
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Origem (meta)
                  </h3>
                  {selected.meta && Object.keys(selected.meta).length > 0 ? (
                    <div className="border rounded-lg divide-y text-xs font-mono">
                      {Object.entries(selected.meta).map(([k, v]) => (
                        <div key={k} className="p-2 flex gap-2">
                          <span className="text-muted-foreground min-w-[120px]">{k}</span>
                          <span className="break-all">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados de origem.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
