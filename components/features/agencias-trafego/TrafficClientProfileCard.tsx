'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Target, Loader2 } from 'lucide-react'
import { saveTrafficClientProfile, type TrafficClientProfile } from '@/actions/traffic-client-profile'

function centsToStr(c?: number | null) { return c ? (c / 100).toFixed(2).replace('.', ',') : '' }
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

const OBJECTIVE_LABELS: Record<string, string> = {
  leads: 'Geração de leads',
  vendas: 'Vendas diretas',
  reconhecimento: 'Reconhecimento de marca',
  trafego_site: 'Tráfego para o site',
  outro: 'Outro',
}

export default function TrafficClientProfileCard({
  orgSlug, contatoId, initial,
}: { orgSlug: string; contatoId: string; initial: TrafficClientProfile | null }) {
  const router = useRouter()
  const [niche, setNiche] = useState(initial?.niche || '')
  const [objective, setObjective] = useState<TrafficClientProfile['objective']>(initial?.objective || 'leads')
  const [monthlyBudget, setMonthlyBudget] = useState(centsToStr(initial?.monthlyBudgetCents))
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience || '')
  const [rules, setRules] = useState(initial?.rules || '')
  const [referenceLinks, setReferenceLinks] = useState(initial?.referenceLinks || '')
  const [contractStart, setContractStart] = useState(initial?.contractStart || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await saveTrafficClientProfile(orgSlug, contatoId, {
      niche: niche || null,
      objective,
      monthlyBudgetCents: strToCents(monthlyBudget),
      targetAudience: targetAudience || null,
      rules: rules || null,
      referenceLinks: referenceLinks || null,
      contractStart: contractStart || null,
      notes: notes || null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Perfil do cliente salvo')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Perfil do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nicho</label>
            <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Odontologia, imóveis, e-commerce…" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Objetivo principal</label>
            <Select value={objective} onValueChange={v => setObjective(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(OBJECTIVE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Orçamento mensal (R$)</label>
            <Input inputMode="decimal" placeholder="0,00" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Início do contrato</label>
            <Input type="date" value={contractStart || ''} onChange={e => setContractStart(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Público-alvo</label>
          <Textarea rows={2} value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Idade, região, interesses…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Regras e restrições da campanha</label>
          <Textarea rows={2} value={rules} onChange={e => setRules(e.target.value)} placeholder="O que não pode aparecer, tom de voz, concorrentes a evitar…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Links de referência/materiais</label>
          <Input value={referenceLinks} onChange={e => setReferenceLinks(e.target.value)} placeholder="Drive, site, redes sociais…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Salvar perfil
        </Button>
      </CardContent>
    </Card>
  )
}
