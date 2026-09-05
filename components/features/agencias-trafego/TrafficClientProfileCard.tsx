'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Target, Users, Package, Lightbulb, ListChecks, Loader2, Plus, X } from 'lucide-react'
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

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/80 p-3.5 space-y-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export default function TrafficClientProfileCard({
  orgSlug, contatoId, initial,
}: { orgSlug: string; contatoId: string; initial: TrafficClientProfile | null }) {
  const router = useRouter()

  // Empresa / Objetivo
  const [niche, setNiche] = useState(initial?.niche || '')
  const [objective, setObjective] = useState<TrafficClientProfile['objective']>(initial?.objective || 'leads')
  const [website, setWebsite] = useState(initial?.website || '')
  const [instagram, setInstagram] = useState(initial?.instagram || '')
  const [region, setRegion] = useState(initial?.region || '')
  const [contractStart, setContractStart] = useState(initial?.contractStart || '')

  // Metas
  const [monthlyBudget, setMonthlyBudget] = useState(centsToStr(initial?.monthlyBudgetCents))
  const [targetRoas, setTargetRoas] = useState(initial?.targetRoas != null ? String(initial.targetRoas) : '')
  const [targetCpl, setTargetCpl] = useState(centsToStr(initial?.targetCpl != null ? initial.targetCpl * 100 : null))
  const [targetCpa, setTargetCpa] = useState(centsToStr(initial?.targetCpaCents))
  const [targetLeads, setTargetLeads] = useState(initial?.targetLeads != null ? String(initial.targetLeads) : '')
  const [targetRevenue, setTargetRevenue] = useState(centsToStr(initial?.targetRevenueCents))
  const [targetLeadToSalePct, setTargetLeadToSalePct] = useState(initial?.targetLeadToSalePct != null ? String(initial.targetLeadToSalePct) : '')

  // Público
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience || '')
  const [audienceAgeRange, setAudienceAgeRange] = useState(initial?.audienceAgeRange || '')
  const [audienceProfile, setAudienceProfile] = useState(initial?.audienceProfile || '')
  const [audienceInterests, setAudienceInterests] = useState(initial?.audienceInterests || '')

  // Oferta
  const [product, setProduct] = useState(initial?.product || '')
  const [avgTicket, setAvgTicket] = useState(centsToStr(initial?.avgTicketCents))
  const [marginPct, setMarginPct] = useState(initial?.marginPct != null ? String(initial.marginPct) : '')
  const [mainOffer, setMainOffer] = useState(initial?.mainOffer || '')
  const [differentials, setDifferentials] = useState(initial?.differentials || '')

  // Estratégia + regras
  const [strategyNotes, setStrategyNotes] = useState(initial?.strategyNotes || '')
  const [referenceLinks, setReferenceLinks] = useState(initial?.referenceLinks || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [rules, setRules] = useState<string[]>(initial?.optimizationRules || [])
  const [newRule, setNewRule] = useState('')

  const [saving, setSaving] = useState(false)

  function addRule() {
    const v = newRule.trim()
    if (!v) return
    setRules(prev => [...prev, v])
    setNewRule('')
  }
  function removeRule(idx: number) {
    setRules(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    const roas = parseFloat(targetRoas.replace(',', '.'))
    const leads = parseInt(targetLeads, 10)
    const cplCents = strToCents(targetCpl)
    const margin = parseFloat(marginPct.replace(',', '.'))
    const leadToSale = parseFloat(targetLeadToSalePct.replace(',', '.'))
    const res = await saveTrafficClientProfile(orgSlug, contatoId, {
      niche: niche || null,
      objective,
      website: website || null,
      instagram: instagram || null,
      region: region || null,
      contractStart: contractStart || null,
      monthlyBudgetCents: strToCents(monthlyBudget),
      targetRoas: Number.isFinite(roas) && roas > 0 ? roas : null,
      targetCpl: cplCents != null ? cplCents / 100 : null,
      targetCpaCents: strToCents(targetCpa),
      targetLeads: Number.isFinite(leads) && leads > 0 ? leads : null,
      targetRevenueCents: strToCents(targetRevenue),
      targetLeadToSalePct: Number.isFinite(leadToSale) && leadToSale > 0 ? leadToSale : null,
      targetAudience: targetAudience || null,
      audienceAgeRange: audienceAgeRange || null,
      audienceProfile: audienceProfile || null,
      audienceInterests: audienceInterests || null,
      product: product || null,
      avgTicketCents: strToCents(avgTicket),
      marginPct: Number.isFinite(margin) ? margin : null,
      mainOffer: mainOffer || null,
      differentials: differentials || null,
      strategyNotes: strategyNotes || null,
      referenceLinks: referenceLinks || null,
      notes: notes || null,
      optimizationRules: rules,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Estratégia do cliente salva')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estratégia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section icon={Building2} title="Empresa">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Nicho/segmento">
              <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Odontologia, imóveis, e-commerce…" />
            </Field>
            <Field label="Região de atuação">
              <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="Cidade/estado" />
            </Field>
            <Field label="Início do contrato">
              <Input type="date" value={contractStart || ''} onChange={e => setContractStart(e.target.value)} />
            </Field>
            <Field label="Site">
              <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Instagram">
              <Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@cliente" />
            </Field>
          </div>
        </Section>

        <Section icon={Target} title="Objetivo e Metas">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Objetivo principal">
              <Select value={objective} onValueChange={v => setObjective(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECTIVE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Investimento mensal (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} />
            </Field>
            <Field label="Meta de leads/mês">
              <Input inputMode="numeric" value={targetLeads} onChange={e => setTargetLeads(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="CPL máximo (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={targetCpl} onChange={e => setTargetCpl(e.target.value)} />
            </Field>
            <Field label="CPA máximo (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={targetCpa} onChange={e => setTargetCpa(e.target.value)} />
            </Field>
            <Field label="ROAS mínimo">
              <Input inputMode="decimal" placeholder="Ex.: 4" value={targetRoas} onChange={e => setTargetRoas(e.target.value)} />
            </Field>
            <Field label="Faturamento esperado/mês (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={targetRevenue} onChange={e => setTargetRevenue(e.target.value)} />
            </Field>
            <Field label="Taxa de conversão lead → venda (%)">
              <Input inputMode="decimal" placeholder="Ex.: 15" value={targetLeadToSalePct} onChange={e => setTargetLeadToSalePct(e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section icon={Users} title="Público">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Idade">
              <Input value={audienceAgeRange} onChange={e => setAudienceAgeRange(e.target.value)} placeholder="25-45 anos" />
            </Field>
            <Field label="Perfil">
              <Input value={audienceProfile} onChange={e => setAudienceProfile(e.target.value)} placeholder="Classe A/B, mães, gestores…" />
            </Field>
            <Field label="Interesses">
              <Input value={audienceInterests} onChange={e => setAudienceInterests(e.target.value)} placeholder="Fitness, decoração…" />
            </Field>
          </div>
          <Field label="Público-alvo (visão geral)">
            <Textarea rows={2} value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Resumo livre do público, se precisar de mais contexto além dos campos acima…" />
          </Field>
        </Section>

        <Section icon={Package} title="Oferta">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Produto/serviço">
              <Input value={product} onChange={e => setProduct(e.target.value)} />
            </Field>
            <Field label="Ticket médio (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={avgTicket} onChange={e => setAvgTicket(e.target.value)} />
            </Field>
            <Field label="Margem (%)">
              <Input inputMode="decimal" placeholder="0" value={marginPct} onChange={e => setMarginPct(e.target.value)} />
            </Field>
          </div>
          <Field label="Oferta principal">
            <Textarea rows={2} value={mainOffer} onChange={e => setMainOffer(e.target.value)} placeholder="O que está sendo anunciado agora…" />
          </Field>
          <Field label="Diferenciais">
            <Textarea rows={2} value={differentials} onChange={e => setDifferentials(e.target.value)} />
          </Field>
        </Section>

        <Section icon={Lightbulb} title="Estratégia">
          <Field label="Estratégia atual">
            <Textarea rows={3} value={strategyNotes} onChange={e => setStrategyNotes(e.target.value)} placeholder="Linha de comunicação, funil, prioridades do momento…" />
          </Field>
          <Field label="Links de referência/materiais">
            <Input value={referenceLinks} onChange={e => setReferenceLinks(e.target.value)} placeholder="Drive, briefing, redes sociais…" />
          </Field>
          <Field label="Observações">
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </Section>

        <Section icon={ListChecks} title="Regras de otimização">
          {rules.length > 0 && (
            <ul className="space-y-1.5">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5">
                  <span className="flex-1 min-w-0">{r}</span>
                  <button type="button" onClick={() => removeRule(i)} className="shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Remover regra">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nova regra</label>
              <Input
                value={newRule}
                onChange={e => setNewRule(e.target.value)}
                placeholder="Ex.: não aumentar orçamento mais que 20% por vez"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }}
              />
            </div>
            <Button size="sm" variant="outline" onClick={addRule}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Section>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Salvar estratégia
        </Button>
      </CardContent>
    </Card>
  )
}
