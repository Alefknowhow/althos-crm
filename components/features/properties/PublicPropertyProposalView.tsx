'use client'

import { useState } from 'react'

export type PublicPropertyItem = {
  id: string
  title: string
  code: string | null
  property_type: string | null
  purpose: string
  address_street: string | null
  address_number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  bedrooms: number | null
  suites: number | null
  bathrooms: number | null
  parking_spots: number | null
  area_total: number | null
  area_useful: number | null
  description_html: string | null
  features: string[] | null
  price_cents: number
  photos: { url: string; is_cover: boolean }[]
}

export type PublicPropertyProposal = {
  id: string
  status: string
  operation_type: 'venda' | 'locacao'
  conditions: string | null
  valid_until: string | null
  created_at: string
  org: {
    legal_name: string | null
    brand_logo_url: string | null
    brand_accent: string | null
    whatsapp_number: string | null
    city_state: string | null
  } | null
  items: PublicPropertyItem[]
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function PhotoGallery({ photos, title }: { photos: { url: string; is_cover: boolean }[]; title: string }) {
  const [active, setActive] = useState(0)
  if (photos.length === 0) {
    return <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">Sem fotos</div>
  }
  return (
    <div className="space-y-1.5">
      <img src={photos[active].url} alt={title} className="w-full aspect-video object-cover rounded-lg bg-muted" />
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p.url + i}
              type="button"
              onClick={() => setActive(i)}
              className="shrink-0"
            >
              <img
                src={p.url} alt=""
                className={`w-16 h-12 object-cover rounded-md border-2 ${i === active ? 'border-primary' : 'border-transparent opacity-70'}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PublicPropertyProposalView({ data }: { data: PublicPropertyProposal }) {
  const totalCents = data.items.reduce((a, it) => a + (it.price_cents || 0), 0)
  const accent = data.org?.brand_accent || undefined

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-3">
          {data.org?.brand_logo_url && (
            <img src={data.org.brand_logo_url} alt="" className="h-10 w-auto object-contain" />
          )}
          <div>
            <h1 className="text-lg font-semibold" style={accent ? { color: accent } : undefined}>
              {data.org?.legal_name || 'Proposta de imóveis'}
            </h1>
            {data.org?.city_state && <p className="text-xs text-muted-foreground">{data.org.city_state}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Proposta de {data.operation_type === 'locacao' ? 'locação' : 'venda'}</h2>
          <p className="text-sm text-muted-foreground">
            {data.items.length} imóve{data.items.length === 1 ? 'l' : 'is'} selecionado{data.items.length === 1 ? '' : 's'}
            {data.valid_until && ` · válida até ${new Date(data.valid_until + 'T12:00:00').toLocaleDateString('pt-BR')}`}
          </p>
        </div>

        {data.items.map(it => (
          <div key={it.id} className="bg-background border rounded-xl overflow-hidden">
            <div className="p-3">
              <PhotoGallery photos={it.photos} title={it.title} />
            </div>
            <div className="p-4 pt-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{it.title}{it.code ? ` · ${it.code}` : ''}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[it.address_street && `${it.address_street}${it.address_number ? `, ${it.address_number}` : ''}`, it.neighborhood, it.city].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold" style={accent ? { color: accent } : undefined}>{fmtCurrency(it.price_cents)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {it.bedrooms != null && <span>{it.bedrooms} dormitório{it.bedrooms === 1 ? '' : 's'}</span>}
                {it.suites != null && it.suites > 0 && <span>{it.suites} suíte{it.suites === 1 ? '' : 's'}</span>}
                {it.bathrooms != null && <span>{it.bathrooms} banheiro{it.bathrooms === 1 ? '' : 's'}</span>}
                {it.parking_spots != null && <span>{it.parking_spots} vaga{it.parking_spots === 1 ? '' : 's'}</span>}
                {it.area_total != null && <span>{it.area_total} m²</span>}
              </div>
              {it.features && it.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {it.features.map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              )}
              {it.description_html && (
                <div className="text-sm pt-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: it.description_html }} />
              )}
            </div>
          </div>
        ))}

        {data.conditions && (
          <div className="bg-background border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-1">Condições</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.conditions}</p>
          </div>
        )}

        {data.items.length > 1 && (
          <div className="bg-background border rounded-xl p-4 flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold" style={accent ? { color: accent } : undefined}>{fmtCurrency(totalCents)}</span>
          </div>
        )}

        {data.org?.whatsapp_number && (
          <a
            href={`https://wa.me/${data.org.whatsapp_number.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="block text-center rounded-xl py-3 font-medium text-white"
            style={{ backgroundColor: accent || '#22c55e' }}
          >
            Falar sobre esta proposta no WhatsApp
          </a>
        )}
      </main>
    </div>
  )
}
