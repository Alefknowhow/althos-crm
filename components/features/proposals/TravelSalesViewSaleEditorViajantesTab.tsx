import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getContatoTravelerInfo, type TravelSaleRow } from '@/actions/travel-sales'
import { Plus, Trash2 } from 'lucide-react'
import { TravelerNameAutocomplete, type LeadOption } from './TravelSalesViewShared'
import ModuleSection from '@/components/design/ModuleSection'

// Aba "Viajantes" — extraída do painel lateral que antes ficava dentro da
// aba "Dados da Reserva" (pedido do redesign: vira aba isolada).
export default function TravelSalesViewSaleEditorViajantesTab({
  orgSlug, travelers, leads, set,
}: {
  orgSlug: string
  travelers: { name?: string; birth_date?: string; cpf?: string; passport_number?: string; passport_expiry?: string }[]
  leads: LeadOption[]
  set: (k: keyof TravelSaleRow, v: any) => void
}) {
  return (
    <TabsContent value="viajantes" className="pt-4">
      <ModuleSection title="Viajantes" contentClassName="space-y-2">
        {travelers.map((t, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/50 p-3">
            <div className="flex-1 min-w-[220px] space-y-1 relative">
              <Label className="text-xs text-muted-foreground">Nome completo</Label>
              <TravelerNameAutocomplete
                leads={leads}
                value={t.name || ''}
                onChangeText={v => { const n = [...travelers]; n[i] = { ...n[i], name: v }; set('travelers', n) }}
                onPickLead={async (leadId) => {
                  const res = await getContatoTravelerInfo(orgSlug, leadId)
                  if (!res.ok) { toast.error(res.error); return }
                  const n = [...travelers]; n[i] = res.data; set('travelers', n)
                }}
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs text-muted-foreground">Nascimento</Label>
              <Input type="date" value={t.birth_date || ''}
                onChange={e => { const n = [...travelers]; n[i] = { ...n[i], birth_date: e.target.value }; set('travelers', n) }} />
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-xs text-muted-foreground">CPF</Label>
              <Input placeholder="000.000.000-00" inputMode="numeric" value={t.cpf || ''}
                onChange={e => { const n = [...travelers]; n[i] = { ...n[i], cpf: e.target.value }; set('travelers', n) }} />
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-xs text-muted-foreground">Nº Passaporte</Label>
              <Input value={t.passport_number || ''}
                onChange={e => { const n = [...travelers]; n[i] = { ...n[i], passport_number: e.target.value }; set('travelers', n) }} />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs text-muted-foreground">Vencimento passaporte</Label>
              <Input type="date" value={t.passport_expiry || ''}
                onChange={e => { const n = [...travelers]; n[i] = { ...n[i], passport_expiry: e.target.value }; set('travelers', n) }} />
            </div>
            <button type="button" onClick={() => set('travelers', travelers.filter((_, j) => j !== i))}
              className="shrink-0 text-muted-foreground hover:text-destructive p-1.5" aria-label="Remover viajante">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set('travelers', [...travelers, { name: '', birth_date: '', cpf: '', passport_number: '', passport_expiry: '' }])}
          className="w-full rounded-xl border border-dashed py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Adicionar viajante
        </button>
      </ModuleSection>
    </TabsContent>
  )
}
