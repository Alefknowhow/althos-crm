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
import {
  Plus, Trash2, Loader2, CheckCircle2, Route, AlertTriangle, Map as MapIcon, LocateFixed,
} from 'lucide-react'

import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import {
  INCLUDED_SUGGESTIONS, NOT_INCLUDED_SUGGESTIONS, nk,
  ToggleRichField,
  F, EditBlock, type GroupId, GroupSection,
  StringList,
} from './QuotationEditorFields'
import type { Pin, QuotationTopState } from './QuotationEditorTypes'

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
