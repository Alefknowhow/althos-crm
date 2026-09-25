'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { submitPortalConversion, type PortalConversion } from '@/actions/client-portal-data'

const TYPE_LABEL: Record<string, string> = {
  lead: 'Lead', qualificado: 'Qualificado', agendamento: 'Agendamento', venda: 'Venda', perdido: 'Perdido',
}

/** Registro manual de conversão (issue #27 §5) — complementa o funil
 *  automático quando o resultado real não é capturado sozinho pelo
 *  tracking. Sem edição/exclusão: cada registro é um evento imutável,
 *  igual a um log. */
export default function PortalConversionsCard({ contatoId, initial }: { contatoId: string; initial: PortalConversion[] }) {
  const [items, setItems] = useState(initial)
  const [type, setType] = useState('lead')
  const [valueReais, setValueReais] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    const valueCents = valueReais.trim() ? Math.round(parseFloat(valueReais.replace(',', '.')) * 100) : null
    const res = await submitPortalConversion(contatoId, { type, valueCents, occurredAt, note: note || null })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Conversão registrada')
    setItems([{ id: crypto.randomUUID(), type: type as any, valueCents, occurredAt, note: note || null, createdAt: new Date().toISOString() }, ...items])
    setValueReais(''); setNote('')
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Conversões</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Registre um resultado real (lead, venda, etc.) quando não for capturado automaticamente pelo tracking.</p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
          </div>
          {type === 'venda' && (
            <div className="space-y-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={valueReais} onChange={e => setValueReais(e.target.value)} placeholder="0,00" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação (opcional)</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
        </div>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Registrar conversão
        </Button>

        {items.length > 0 && (
          <div className="divide-y border-t pt-2">
            {items.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{TYPE_LABEL[c.type] || c.type}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(c.occurredAt).toLocaleDateString('pt-BR')}</span>
                  {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                </div>
                {c.valueCents != null && <span className="text-sm tabular-nums font-medium">{formatCurrency(c.valueCents)}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
