'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Image as ImageIcon, MapPin } from 'lucide-react'
import { CoverUpload, F, EditBlock, type GroupId, GroupSection } from './QuotationEditorFields'

type QState = any

export default function QuotationEditorResumoGroup({
  orgSlug, activeGroup, q, setQ, isOffer, leads, completeness, missingLabels,
}: {
  orgSlug: string
  activeGroup: GroupId
  q: QState
  setQ: (fn: (s: QState) => QState) => void
  isOffer: boolean
  leads: { id: string; name: string; phone?: string | null }[]
  completeness: number
  missingLabels: string[]
}) {
  return (
    <GroupSection id="resumo" active={activeGroup}>
      {/* CAPA */}
      <EditBlock id="blk-capa" icon={ImageIcon} title="Capa">
        <div className="grid grid-cols-2 gap-3">
          <F label="Título (H1 do hero)"><Input value={q.title} onChange={e => setQ(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Punta Cana, 7 noites à beira-mar" /></F>
          <F label="Subtítulo (H2)"><Input value={q.subtitle} onChange={e => setQ(s => ({ ...s, subtitle: e.target.value }))} placeholder="Ex.: All-inclusive no Caribe — sol, mar e descanso" /></F>
        </div>
        {isOffer ? (
          <div className="grid grid-cols-2 gap-3">
            <F label="Categoria (vitrine)"><Input value={q.offer_category} onChange={e => setQ(s => ({ ...s, offer_category: e.target.value }))} placeholder="Ex.: Praia, Lua de mel, Nacional" /></F>
            <F label="Publicar na vitrine" hint="aparece no link público da vitrine quando ligado">
              <label className="flex items-center gap-2 h-9 text-sm">
                <Switch checked={q.offer_published} onCheckedChange={v => setQ(s => ({ ...s, offer_published: v }))} />
                {q.offer_published ? 'Publicada' : 'Rascunho (oculta)'}
              </label>
            </F>
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 space-y-3">
              <F label="Contato do CRM" hint="liga a cotação ao lead da pipeline (timeline + lead scoring) — o nome do cliente vem daqui">
                <Select value={q.contato_id || 'none'}
                  onValueChange={v => setQ(s => {
                    const lead = leads.find(l => l.id === v)
                    return { ...s, contato_id: v === 'none' ? null : v, client_name: v === 'none' ? s.client_name : (lead?.name || s.client_name) }
                  })}>
                  <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Nome do cliente" hint={q.contato_id ? 'vem do contato vinculado acima' : undefined}>
                <Input value={q.client_name} disabled={!!q.contato_id}
                  onChange={e => setQ(s => ({ ...s, client_name: e.target.value }))} placeholder="Ex.: Ricardo Almeida" />
              </F>
            </div>
            <div className="w-1/2 shrink-0">
              <F label="Imagem de capa">
                <CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))}
                  unsplashHint={q.destinations[0]?.name || ''} />
              </F>
            </div>
          </div>
        )}
        {isOffer && (
          <F label="Imagem de capa">
            <CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))}
              unsplashHint={q.destinations[0]?.name || ''} />
          </F>
        )}
      </EditBlock>

      {/* VIAGEM */}
      <EditBlock id="blk-viagem" icon={MapPin} title="Viagem">
        <div className="grid grid-cols-4 gap-3">
          <F label="Origem"><Input value={q.origin_label} onChange={e => setQ(s => ({ ...s, origin_label: e.target.value }))} placeholder="Florianópolis" /></F>
          <F label="Destino"><Input placeholder="Ilhéus, Brasil" value={q.destinations[0]?.name || ''}
            onChange={e => setQ(s => ({ ...s, destinations: [{ name: e.target.value, country: '' }] }))} /></F>
          <F label="Data de ida"><Input type="date" value={q.start_date} onChange={e => setQ(s => ({ ...s, start_date: e.target.value }))} /></F>
          <F label="Data de volta"><Input type="date" value={q.end_date} onChange={e => setQ(s => ({ ...s, end_date: e.target.value }))} /></F>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <F label="Adultos"><Input type="number" min={0} maxLength={3} className="w-16" value={q.pax_adults} onChange={e => setQ(s => ({ ...s, pax_adults: Math.max(0, parseInt(e.target.value) || 0) }))} /></F>
          <F label="Crianças"><Input type="number" min={0} maxLength={3} className="w-16" value={q.pax_children} onChange={e => {
            const n = Math.max(0, parseInt(e.target.value) || 0)
            setQ(s => ({ ...s, pax_children: n, children_ages: s.children_ages.slice(0, n) }))
          }} /></F>
          {q.pax_children > 0 && (
            <F label="Idades das crianças">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: q.pax_children }).map((_, i) => (
                  <Input key={i} type="number" min={0} max={17} className="w-16" value={q.children_ages[i] ?? ''}
                    onChange={e => setQ(s => { const n = [...s.children_ages]; n[i] = Math.min(17, Math.max(0, parseInt(e.target.value) || 0)); return { ...s, children_ages: n } })} />
                ))}
              </div>
            </F>
          )}
        </div>
      </EditBlock>

      {missingLabels.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Cotação {completeness}% completa</p>
          <p>Faltam: {missingLabels.join(', ')}.</p>
        </div>
      )}
    </GroupSection>
  )
}
