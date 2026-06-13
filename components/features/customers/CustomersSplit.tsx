'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Search, MapPin, FileCheck2, ExternalLink, Mail, Phone, ChevronLeft,
  Users, Wallet, CalendarClock, UserCheck,
} from 'lucide-react'
import type { CustomerListRow } from '@/actions/contatos'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name || '?').slice(0, 2).toUpperCase()
}

export default function CustomersSplit({
  orgSlug,
  customers,
}: {
  orgSlug: string
  customers: CustomerListRow[]
}) {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [hasDocsOnly, setHasDocsOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null)
  const [mobileDetail, setMobileDetail] = useState(false)

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

  // Keep a valid selection as the filtered list changes.
  useEffect(() => {
    if (!filtered.some(c => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  const selected = useMemo(
    () => filtered.find(c => c.id === selectedId) ?? null,
    [filtered, selectedId],
  )

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
            <option key={s} value={s}>{s}</option>
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

      {/* Master-detail */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-280px)] lg:min-h-[460px]">
        {/* ── Master: compact list ───────────────────────────────── */}
        <div
          className={cn(
            'lg:w-1/2 lg:shrink-0 rounded-xl border bg-card overflow-y-auto',
            mobileDetail && 'hidden lg:block',
          )}
        >
          <div className="divide-y">
            {filtered.map(c => {
              const active = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setMobileDetail(true) }}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                    active ? 'bg-primary/10' : 'hover:bg-muted/40',
                  )}
                >
                  <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-xs font-semibold">
                    {initials(c.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {c.has_documents && (
                        <FileCheck2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.city || c.state
                        ? [c.city, c.state].filter(Boolean).join(' · ')
                        : (c.email || c.phone || 'Sem contato')}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {fmtCurrency(c.total_purchased_cents)}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Nenhum cliente corresponde aos filtros.
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ───────────────────────────────────────── */}
        <div
          className={cn(
            'lg:w-1/2 lg:flex-1 rounded-xl border bg-card overflow-y-auto',
            !mobileDetail && 'hidden lg:block',
          )}
        >
          {selected ? (
            <CustomerPreview
              customer={selected}
              orgSlug={orgSlug}
              onBack={() => setMobileDetail(false)}
            />
          ) : (
            <div className="h-full grid place-items-center p-10 text-center">
              <div className="space-y-2 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm">Selecione um cliente para ver o resumo.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomerPreview({
  customer,
  orgSlug,
  onBack,
}: {
  customer: CustomerListRow
  orgSlug: string
  onBack: () => void
}) {
  const c = customer
  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="lg:hidden mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="shrink-0 w-12 h-12 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-base font-semibold">
          {initials(c.name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold leading-tight">{c.name}</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <UserCheck className="w-3 h-3 mr-1" /> Cliente
            </Badge>
          </div>
          {c.became_customer_at && (
            <p className="text-sm text-muted-foreground">
              cliente desde {fmtDate(c.became_customer_at)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/app/${orgSlug}/contatos/${c.id}`}>
            <ExternalLink className="w-4 h-4 mr-1.5" /> Página completa
          </Link>
        </Button>
        {c.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/${(c.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              <Phone className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>
        )}
        {c.email && (
          <Button size="sm" variant="outline" asChild>
            <a href={`mailto:${c.email}`}>
              <Mail className="w-4 h-4 mr-1.5" /> E-mail
            </a>
          </Button>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Field icon={Wallet} label="Total comprado">
          <span className="text-2xl font-bold text-primary">{fmtCurrency(c.total_purchased_cents)}</span>
        </Field>
        <Field icon={CalendarClock} label="Última compra">
          <span className="text-2xl font-bold">{fmtDate(c.last_purchase_at)}</span>
        </Field>
      </div>

      {/* Contact + location */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Field icon={Mail} label="E-mail">
          <span className="text-sm font-medium break-all">{c.email || '—'}</span>
        </Field>
        <Field icon={Phone} label="Telefone">
          <span className="text-sm font-medium">{c.phone || '—'}</span>
        </Field>
        <Field icon={MapPin} label="Localização">
          <span className="text-sm font-medium">
            {c.city || c.state ? [c.city, c.state].filter(Boolean).join(' · ') : '—'}
          </span>
        </Field>
        <Field icon={FileCheck2} label="Documentos">
          <span className="text-sm font-medium">
            {c.has_documents ? 'Anexados' : 'Nenhum'}
          </span>
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        Abra a página completa para ver perfil detalhado, documentos e histórico de compras.
      </p>
    </div>
  )
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  )
}
