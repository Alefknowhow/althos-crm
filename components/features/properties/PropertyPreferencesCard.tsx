'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Loader2 } from 'lucide-react'
import { savePropertyPreferences, type PropertyPreferences } from '@/actions/property-preferences'

function centsToStr(c?: number | null) { return c ? (c / 100).toFixed(2).replace('.', ',') : '' }
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default function PropertyPreferencesCard({
  orgSlug, contatoId, initial,
}: { orgSlug: string; contatoId: string; initial: PropertyPreferences | null }) {
  const router = useRouter()
  const [purpose, setPurpose] = useState<'venda' | 'locacao' | 'qualquer'>(initial?.purpose || 'qualquer')
  const [priceMin, setPriceMin] = useState(centsToStr(initial?.priceMin))
  const [priceMax, setPriceMax] = useState(centsToStr(initial?.priceMax))
  const [bedroomsMin, setBedroomsMin] = useState(initial?.bedroomsMin ? String(initial.bedroomsMin) : '')
  const [city, setCity] = useState(initial?.city || '')
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood || '')
  const [propertyType, setPropertyType] = useState(initial?.propertyType || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await savePropertyPreferences(orgSlug, contatoId, {
      purpose, priceMin: strToCents(priceMin), priceMax: strToCents(priceMax),
      bedroomsMin: bedroomsMin ? parseInt(bedroomsMin, 10) : null,
      city: city || null, neighborhood: neighborhood || null, propertyType: propertyType || null,
      notes: notes || null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Preferências salvas')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Home className="w-4 h-4" /> Preferências de imóvel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Finalidade</label>
            <Select value={purpose} onValueChange={v => setPurpose(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualquer">Qualquer</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de imóvel</label>
            <Input value={propertyType} onChange={e => setPropertyType(e.target.value)} placeholder="Apartamento, casa…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Preço mínimo (R$)</label>
            <Input inputMode="decimal" placeholder="0,00" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Preço máximo (R$)</label>
            <Input inputMode="decimal" placeholder="0,00" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Dormitórios (mín.)</label>
            <Input inputMode="numeric" value={bedroomsMin} onChange={e => setBedroomsMin(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cidade</label>
            <Input value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bairro</label>
            <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferências adicionais do lead…" />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Salvar preferências
        </Button>
      </CardContent>
    </Card>
  )
}
