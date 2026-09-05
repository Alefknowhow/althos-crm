'use client'

/**
 * Bloco "Hospedagens" do grupo Produtos — extraído de
 * QuotationEditorProductsGroup.tsx (pura movimentação de JSX).
 */

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Loader2, Search, BedDouble, Star } from 'lucide-react'

import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import {
  BOARD_OPTIONS, nk, PhotoGallery, SortableList, F, EditBlock,
} from './QuotationEditorFields'
import type { Lodging, QuotationTopState } from './QuotationEditorTypes'

export default function QuotationEditorLodgingsBlock({
  orgSlug, q, lodgings, setLodgings, taBusy, taLookup,
}: {
  orgSlug: string
  q: QuotationTopState
  lodgings: Lodging[]; setLodgings: React.Dispatch<React.SetStateAction<Lodging[]>>
  taBusy: string | null; taLookup: (l: Lodging) => void
}) {
  return (
    <EditBlock id="blk-hospedagens" icon={BedDouble} title="Hospedagens"
      action={<Button type="button" variant="outline" size="sm"
        onClick={() => setLodgings(ls => [...ls, { _key: nk(), name: '', photos: [], check_in: q.start_date || null, check_out: q.end_date || null, check_in_time: '15:00', check_out_time: '12:00' }])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Hospedagem
      </Button>}>
      {lodgings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hospedagem.</p>}
      <SortableList items={lodgings} onReorder={setLodgings} render={(l) => (
        <>
          <div className="flex gap-1.5">
            <Input className="flex-1" placeholder="Nome do hotel/resort" value={l.name}
              onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, name: e.target.value } : x))} />
            <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={taBusy === l._key}
              title="Buscar no TripAdvisor (nota, fotos, localização)" onClick={() => taLookup(l)}>
              {taBusy === l._key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span className="ml-1 hidden sm:inline">TripAdvisor</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => setLodgings(ls => ls.filter(x => x._key !== l._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          {l.tripadvisor_data && (
            <>
              <p className="text-[11px] text-emerald-600">✓ TripAdvisor vinculado{l.tripadvisor_data.rating ? ` · nota ${l.tripadvisor_data.rating}` : ''}{l.tripadvisor_data.reviews_count ? ` · ${l.tripadvisor_data.reviews_count} avaliações` : ''}</p>
              {l.tripadvisor_data.address && (
                <p className="text-[11px] text-muted-foreground">📍 {l.tripadvisor_data.address}</p>
              )}
            </>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <F label="Check-in"><Input type="date" value={l.check_in || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_in: e.target.value } : x))} /></F>
            <F label="Horário check-in"><Input type="time" value={l.check_in_time ?? '15:00'} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_in_time: e.target.value } : x))} /></F>
            <F label="Check-out"><Input type="date" value={l.check_out || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_out: e.target.value } : x))} /></F>
            <F label="Horário check-out"><Input type="time" value={l.check_out_time ?? '12:00'} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_out_time: e.target.value } : x))} /></F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <F label="Categoria do quarto"><Input placeholder="Suíte The Level · vista jardim" value={l.room_category || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, room_category: e.target.value } : x))} /></F>
            <F label="Regime">
              <Select value={l.board || 'none'} onValueChange={v => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, board: v === 'none' ? null : v } : x))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não exibir</SelectItem>
                  {BOARD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Categoria do hotel">
              <div className="flex items-center gap-0.5 h-9">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    title={`${n} estrela${n > 1 ? 's' : ''}`}
                    onClick={() => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, star_rating: x.star_rating === n ? null : n } : x))}
                    className="p-0.5 hover:scale-110 transition-transform"
                  >
                    <Star className={cn('w-5 h-5', (l.star_rating || 0) >= n ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                  </button>
                ))}
              </div>
            </F>
          </div>
          <F label="Descrição">
            <ItineraryEditor orgSlug={orgSlug} value={l.description_html || ''}
              onChange={html => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, description_html: html } : x))} />
          </F>
          <F label="Fotos">
            <PhotoGallery orgSlug={orgSlug} photos={l.photos}
              onChange={p => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, photos: p } : x))} />
          </F>
          <label className="flex items-center gap-2 text-xs font-medium rounded-lg border p-2.5 bg-muted/20">
            <Switch checked={!!l.is_alternative_option}
              onCheckedChange={v => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, is_alternative_option: v } : x))} />
            Esta é uma opção alternativa (cliente escolhe esta OU outra hospedagem — preços editados em Investimento)
          </label>
        </>
      )} />
    </EditBlock>
  )
}
