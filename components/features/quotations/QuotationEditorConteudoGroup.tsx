'use client'

/**
 * Grupo "Conteúdo" (parte 2) do editor de cotação — Mapa, Itinerário,
 * Importante, O que inclui e Políticas de cancelamento.
 *
 * Extraído de QuotationEditor.tsx (pura movimentação de JSX, sem mudança de
 * comportamento) — recebe o estado relevante e os setters via props.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Plus, Trash2, Loader2, CheckCircle2, Route, AlertTriangle, Map as MapIcon, LocateFixed, Plane,
} from 'lucide-react'

import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import AnimatedMapBlock from './AnimatedMapBlock'
import { resolveCountry } from '@/lib/geo/countries'
import { CITIES_BY_ISO2 } from '@/lib/geo/cities'
import {
  INCLUDED_SUGGESTIONS, NOT_INCLUDED_SUGGESTIONS, nk,
  ToggleRichField,
  F, EditBlock, type GroupId, GroupSection,
  StringList,
} from './QuotationEditorFields'
import type { Pin, QuotationTopState } from './QuotationEditorTypes'

const EMPTY_ROUTE = { origin: { country: '', city: '' }, stops: [] as { country: string; city?: string }[] }

function CountryStatusHint({ country }: { country: string }) {
  if (!country.trim()) return null
  const info = resolveCountry(country)
  return info
    ? <p className="text-[11px] text-emerald-600">✓ {info.name} reconhecido</p>
    : <p className="text-[11px] text-amber-600">⚠ país não reconhecido — não aparecerá na animação</p>
}

function CityField({ country, value, onChange }: { country: string; value: string; onChange: (v: string) => void }) {
  const info = resolveCountry(country)
  const cities = info ? CITIES_BY_ISO2[info.iso2] : undefined
  if (cities && cities.length > 0) {
    return (
      <Select value={value || '__none'} onValueChange={v => onChange(v === '__none' ? '' : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Cidade (opcional)" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Sem cidade (usa o país)</SelectItem>
          {cities.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  return <Input placeholder="Cidade (opcional, só decorativo)" value={value} onChange={e => onChange(e.target.value)} />
}

export default function QuotationEditorConteudoGroup({
  orgSlug, activeGroup, q, setQ,
  pins, setPins, geoBusy, pinGeocode,
}: {
  orgSlug: string
  activeGroup: GroupId
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  pins: Pin[]; setPins: React.Dispatch<React.SetStateAction<Pin[]>>
  geoBusy: string | null
  pinGeocode: (p: Pin) => void
}) {
  return (
    <GroupSection id="conteudo" active={activeGroup}>
      {/* MAPA */}
      <EditBlock id="blk-mapa" icon={MapIcon} title="Mapa"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setPins(ps => [...ps, { _key: nk(), label: '', type: 'attraction' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Pin
        </Button>}>
        <p className="text-[11px] text-muted-foreground">O mapa da cotação mostra só os pins adicionados aqui — inclua hospedagens, atrações e aeroporto manualmente.</p>
        {pins.map(p => (
          <div key={p._key} className="rounded-lg border p-2.5 space-y-2">
            <div className="flex gap-1.5">
              <Select value={p.type} onValueChange={v => setPins(ps => ps.map(x => x._key === p._key ? { ...x, type: v } : x))}>
                <SelectTrigger className="w-[120px] shrink-0 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attraction">Atração</SelectItem>
                  <SelectItem value="airport">Aeroporto</SelectItem>
                  <SelectItem value="lodging">Hospedagem</SelectItem>
                  <SelectItem value="custom">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input className="flex-1" placeholder="Local (ex.: Isla Saona)" value={p._query ?? p.label}
                onChange={e => setPins(ps => ps.map(x => x._key === p._key ? { ...x, _query: e.target.value, label: e.target.value, lat: null, lng: null } : x))} />
              <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={geoBusy === p._key}
                title="Buscar coordenadas" onClick={() => pinGeocode(p)}>
                {geoBusy === p._key ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setPins(ps => ps.filter(x => x._key !== p._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {p.lat != null
              ? <p className="text-[11px] text-emerald-600">✓ posicionado ({p.lat!.toFixed(4)}, {p.lng!.toFixed(4)})</p>
              : <p className="text-[11px] text-amber-600">sem posição — clique na mira para buscar</p>}
          </div>
        ))}
      </EditBlock>

      {/* MAPA ANIMADO — avião voando origem → paradas, rastro + bandeiras */}
      <EditBlock id="blk-mapa-animado" icon={Plane} title="Mapa animado"
        action={<Switch checked={q.animated_map_enabled}
          onCheckedChange={v => setQ(s => ({
            ...s,
            animated_map_enabled: v,
            animated_map_route: s.animated_map_route ?? EMPTY_ROUTE,
          }))} />}>
        <p className="text-[11px] text-muted-foreground">
          Bloco visual com um avião voando da origem até cada destino, deixando um rastro e pintando o país com a bandeira dele. Aparece no início da cotação e no link público.
        </p>
        {q.animated_map_enabled && (
          <>
            <div className="rounded-lg border p-2.5 space-y-2">
              <p className="text-xs font-medium">Origem</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                <div className="space-y-1">
                  <Input placeholder="País (ex.: Brasil)"
                    value={q.animated_map_route?.origin.country ?? ''}
                    onChange={e => setQ(s => ({
                      ...s,
                      animated_map_route: {
                        origin: { ...(s.animated_map_route?.origin ?? { country: '' }), country: e.target.value },
                        stops: s.animated_map_route?.stops ?? [],
                      },
                    }))} />
                  <CountryStatusHint country={q.animated_map_route?.origin.country ?? ''} />
                </div>
                <CityField country={q.animated_map_route?.origin.country ?? ''} value={q.animated_map_route?.origin.city ?? ''}
                  onChange={v => setQ(s => ({
                    ...s,
                    animated_map_route: {
                      origin: { ...(s.animated_map_route?.origin ?? { country: '' }), city: v },
                      stops: s.animated_map_route?.stops ?? [],
                    },
                  }))} />
              </div>
            </div>

            {(q.animated_map_route?.stops ?? []).map((stop, i) => (
              <div key={i} className="rounded-lg border p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Parada {i + 1}</p>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setQ(s => ({
                      ...s,
                      animated_map_route: {
                        origin: s.animated_map_route?.origin ?? { country: '' },
                        stops: (s.animated_map_route?.stops ?? []).filter((_, idx) => idx !== i),
                      },
                    }))}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  <div className="space-y-1">
                    <Input placeholder="País (ex.: Espanha)" value={stop.country}
                      onChange={e => setQ(s => ({
                        ...s,
                        animated_map_route: {
                          origin: s.animated_map_route?.origin ?? { country: '' },
                          stops: (s.animated_map_route?.stops ?? []).map((x, idx) => idx === i ? { ...x, country: e.target.value } : x),
                        },
                      }))} />
                    <CountryStatusHint country={stop.country} />
                  </div>
                  <CityField country={stop.country} value={stop.city ?? ''}
                    onChange={v => setQ(s => ({
                      ...s,
                      animated_map_route: {
                        origin: s.animated_map_route?.origin ?? { country: '' },
                        stops: (s.animated_map_route?.stops ?? []).map((x, idx) => idx === i ? { ...x, city: v } : x),
                      },
                    }))} />
                </div>
              </div>
            ))}

            {(q.animated_map_route?.stops?.length ?? 0) < 6 && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => setQ(s => ({
                  ...s,
                  animated_map_route: {
                    origin: s.animated_map_route?.origin ?? { country: '' },
                    stops: [...(s.animated_map_route?.stops ?? []), { country: '', city: '' }],
                  },
                }))}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Parada
              </Button>
            )}

            <div className="pt-1">
              <p className="text-xs font-medium mb-1.5">Pré-visualização</p>
              <AnimatedMapBlock route={q.animated_map_route} />
            </div>
          </>
        )}
      </EditBlock>

      {/* ITINERÁRIO — texto livre rico (fonte, cor, imagens) */}
      <EditBlock id="blk-itinerario" icon={Route} title="Itinerário">
        <p className="text-[11px] text-muted-foreground">
          Escreva o roteiro do jeito que preferir. Formate a letra (fonte, tamanho, cor),
          e insira imagens pelo botão, colando (Ctrl+V) ou arrastando para o texto.
        </p>
        <ItineraryEditor orgSlug={orgSlug} value={q.itinerary_html}
          onChange={html => setQ(s => ({ ...s, itinerary_html: html }))} />
      </EditBlock>

      {/* IMPORTANTE */}
      <EditBlock id="blk-importante" icon={AlertTriangle} title="Importante">
        <ToggleRichField orgSlug={orgSlug} value={q.important_html} onChange={html => setQ(s => ({ ...s, important_html: html }))} />
      </EditBlock>

      {/* O QUE INCLUI */}
      <EditBlock id="blk-inclui" icon={CheckCircle2} title="O que inclui">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Incluso"><StringList items={q.included} placeholder="Passagem aérea ida e volta" suggestions={INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, included: v }))} /></F>
          <F label="Não incluso"><StringList items={q.not_included} placeholder="Seguro viagem" suggestions={NOT_INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, not_included: v }))} /></F>
        </div>
      </EditBlock>

      {/* POLÍTICAS DE CANCELAMENTO */}
      <EditBlock id="blk-cancelamento" icon={AlertTriangle} title="Políticas de cancelamento">
        <ToggleRichField orgSlug={orgSlug} value={q.cancellation_html} onChange={html => setQ(s => ({ ...s, cancellation_html: html }))} />
      </EditBlock>
    </GroupSection>
  )
}
