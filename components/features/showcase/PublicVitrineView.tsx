'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, CalendarRange, Store, Video } from 'lucide-react'
import { categoryLabel, sortCategories } from '@/lib/showcase'

type Org = {
  name: string | null
  logo_url: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram: string | null
  website: string | null
}

type Pkg = {
  id: string
  title: string | null
  category: string | null
  youtube_url: string | null
  cover_photos: string[]
  start_date: string | null
  end_date: string | null
  destinations: any[]
  total_cents: number
}

function brl(cents?: number | null) {
  return ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function destOf(p: Pkg) {
  return (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
}

export default function PublicVitrineView({
  token, packages, org,
}: {
  token: string
  packages: Pkg[]
  org: Org
}) {
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const [active, setActive] = useState<string>('all')
  const companyName = org.name || 'Agência de Viagens'

  const categories = useMemo(
    () => sortCategories(packages.map(p => p.category)),
    [packages],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Pkg[]>()
    for (const p of packages) {
      if (active !== 'all' && (p.category || '__none') !== active) continue
      const key = p.category || '__none'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return sortCategories(Array.from(map.keys())).map(key => ({
      key,
      label: key === '__none' ? 'Outros' : categoryLabel(key),
      items: map.get(key) || [],
    }))
  }, [packages, active])

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center gap-4">
          {org.logo_url && !imgErr['logo'] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={companyName} className="h-12 w-auto object-contain"
              onError={() => setImgErr(e => ({ ...e, logo: true }))} />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
              {companyName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-xl font-bold text-slate-900">{companyName}</p>
            <p className="text-sm text-slate-500">Pacotes de viagem disponíveis</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filtros de categoria */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            <button
              onClick={() => setActive('all')}
              className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${active === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${active === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                {c === '__none' ? 'Outros' : categoryLabel(c)}
              </button>
            ))}
          </div>
        )}

        {packages.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Store className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Nenhum pacote disponível no momento.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(group => (
              <section key={group.key}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{group.label}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map(p => {
                    const cover = (p.cover_photos || [])[0]
                    const dest = destOf(p)
                    return (
                      <Link
                        key={p.id}
                        href={`/v/${token}/${p.id}`}
                        className="group rounded-xl border bg-white overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                      >
                        <div className="relative h-40 bg-slate-100">
                          {cover && !imgErr[p.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover} alt="" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                              onError={() => setImgErr(e => ({ ...e, [p.id]: true }))} />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                              {p.youtube_url ? <Video className="w-8 h-8" /> : <Store className="w-8 h-8" />}
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <p className="font-semibold text-slate-800 leading-tight line-clamp-2">{p.title || 'Pacote de viagem'}</p>
                          {dest && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{dest}</span>
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <CalendarRange className="w-3 h-3 shrink-0" />
                            <span className="truncate">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t flex items-end justify-between">
                            <span className="text-[11px] text-slate-400">a partir de</span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums">{brl(p.total_cents)}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">{companyName}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {org.cnpj && <span>CNPJ: {org.cnpj}</span>}
            {org.cadastur && <span>CADASTUR: {org.cadastur}</span>}
            {org.contact_phone && <span>Tel: {org.contact_phone}</span>}
            {org.contact_email && <span>{org.contact_email}</span>}
            {org.instagram && <span>Instagram: {org.instagram.startsWith('@') ? org.instagram : `@${org.instagram}`}</span>}
            {org.website && <span>{org.website.replace(/^https?:\/\//, '')}</span>}
          </div>
        </footer>
      </div>
    </div>
  )
}
