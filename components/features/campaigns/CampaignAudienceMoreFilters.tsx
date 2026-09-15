'use client'

/** Dimensões extra do filtro de público — colapsado por padrão dentro de
 *  NewCampaignForm.tsx, pra não inchar o formulário. Mesmas dimensões já
 *  usadas em app/app/[orgSlug]/contatos/page.tsx. */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CONTATO_STATUSES, CONTATO_STATUS_META, contatoSourceLabel } from '@/lib/contatos'

export default function CampaignAudienceMoreFilters({
  sources, selectedStatus, toggleStatus, selectedSources, toggleSource,
  tier, setTier, hasEmail, setHasEmail, hasPhone, setHasPhone,
  noContactDays, setNoContactDays, createdFrom, setCreatedFrom, createdTo, setCreatedTo,
  valueMin, setValueMin, valueMax, setValueMax,
}: {
  sources: string[]
  selectedStatus: string[]
  toggleStatus: (s: string) => void
  selectedSources: string[]
  toggleSource: (s: string) => void
  tier: string
  setTier: (v: string) => void
  hasEmail: boolean
  setHasEmail: (v: boolean) => void
  hasPhone: boolean
  setHasPhone: (v: boolean) => void
  noContactDays: string
  setNoContactDays: (v: string) => void
  createdFrom: string
  setCreatedFrom: (v: string) => void
  createdTo: string
  setCreatedTo: (v: string) => void
  valueMin: string
  setValueMin: (v: string) => void
  valueMax: string
  setValueMax: (v: string) => void
}) {
  return (
    <div className="space-y-3 pt-1 border-t">
      <div className="space-y-1.5 pt-2">
        <Label className="text-xs text-muted-foreground font-normal">Classificação (OU)</Label>
        <div className="flex flex-wrap gap-1.5">
          {CONTATO_STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-none border transition-colors ${selectedStatus.includes(s) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
            >
              {CONTATO_STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Origem (OU)</Label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {sources.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSource(s)}
                className={`px-2.5 py-1 text-xs rounded-none border transition-colors ${selectedSources.includes(s) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
              >
                {contatoSourceLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-normal">Classificação IA</Label>
        <Select value={tier || '__all__'} onValueChange={v => setTier(v === '__all__' ? '' : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            <SelectItem value="hot">Quente</SelectItem>
            <SelectItem value="warm">Morno</SelectItem>
            <SelectItem value="cold">Frio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 accent-primary"
            checked={hasEmail}
            onChange={e => setHasEmail(e.target.checked)}
          />
          Com e-mail
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 accent-primary"
            checked={hasPhone}
            onChange={e => setHasPhone(e.target.checked)}
          />
          Com telefone
        </label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-normal">Sem contato há (dias)</Label>
        <Input
          type="number" min={0}
          value={noContactDays}
          onChange={e => setNoContactDays(e.target.value)}
          placeholder="ex.: 30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Criado de</Label>
          <Input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Criado até</Label>
          <Input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Valor mín. (R$)</Label>
          <Input type="number" min={0} value={valueMin} onChange={e => setValueMin(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Valor máx. (R$)</Label>
          <Input type="number" min={0} value={valueMax} onChange={e => setValueMax(e.target.value)} />
        </div>
      </div>
    </div>
  )
}
