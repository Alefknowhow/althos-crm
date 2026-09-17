'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { generateMediaPlanSuggestion, applyMediaPlanSuggestion, type MediaPlanSuggestion } from '@/actions/marketing-strategist'
import { getAgencyMethod, saveAgencyMethod, type AgencyMethod } from '@/actions/agency-method'
import { PLATFORM_LABEL } from '@/components/features/agencias-trafego/media-plan-shared'
import { VoiceInputButton } from '@/components/features/ai/VoiceInputButton'

/**
 * Althos Marketing Strategist — ícone flutuante (canto inferior direito do
 * workspace do cliente) que abre um painel lateral fixo, sempre escopado a
 * `contatoId`. Gera uma sugestão de plano de mídia estruturada (mesmo
 * schema de MediaPlanBuilder) a partir da Inteligência do Cliente + Método
 * da Agência + performance real. A saída nunca é salva direto: fica em
 * preview até o usuário revisar e clicar "Aplicar", que cria uma nova
 * versão do plano (ver actions/marketing-strategist.ts).
 */
export default function MarketingStrategistDock({
  orgSlug, contatoId, onApplied,
}: {
  orgSlug: string
  contatoId: string
  onApplied: () => void
}) {
  const [open, setOpen] = useState(false)
  const [briefing, setBriefing] = useState('')
  const [suggestion, setSuggestion] = useState<MediaPlanSuggestion | null>(null)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [method, setMethod] = useState<AgencyMethod | null>(null)
  const [showMethod, setShowMethod] = useState(false)
  const [savingMethod, setSavingMethod] = useState(false)

  useEffect(() => {
    if (open && method === null) getAgencyMethod(orgSlug).then(m => setMethod(m || {}))
  }, [open, orgSlug, method])

  async function handleSaveMethod() {
    if (!method) return
    setSavingMethod(true)
    const res = await saveAgencyMethod(orgSlug, method)
    setSavingMethod(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Método da agência salvo — vale pra todos os clientes.')
  }

  async function handleGenerate() {
    setGenerating(true)
    setSuggestion(null)
    const res = await generateMediaPlanSuggestion(orgSlug, contatoId, briefing || undefined)
    setGenerating(false)
    if (!res.ok) { toast.error(res.error); return }
    setSuggestion(res.suggestion)
  }

  async function handleApply() {
    if (!suggestion) return
    setApplying(true)
    const res = await applyMediaPlanSuggestion(orgSlug, contatoId, suggestion)
    setApplying(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Plano criado a partir da sugestão da IA.')
    setSuggestion(null)
    onApplied()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center hover:scale-105 transition-transform',
          open && 'hidden',
        )}
        aria-label="Abrir Marketing Strategist"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <span className="flex items-center gap-2 font-semibold text-sm"><Sparkles className="w-4 h-4" /> Marketing Strategist</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button type="button" onClick={() => setShowMethod(v => !v)} className="text-xs text-muted-foreground underline underline-offset-2">
                {showMethod ? 'Ocultar' : 'Configurar'} método da agência (aplica a todos os clientes)
              </button>
              {showMethod && method && (
                <div className="border rounded-xl p-3 space-y-2 bg-muted/30">
                  <Textarea placeholder="Regras de estrutura de campanha" value={method.campaignStructureRules ?? ''} onChange={e => setMethod({ ...method, campaignStructureRules: e.target.value })} className="text-xs min-h-[50px]" />
                  <Textarea placeholder="Critérios de teste (ex.: mínimo de variações de criativo, duração do teste)" value={method.testingCriteria ?? ''} onChange={e => setMethod({ ...method, testingCriteria: e.target.value })} className="text-xs min-h-[50px]" />
                  <Textarea placeholder="Critérios de otimização e pausa" value={method.optimizationCriteria ?? ''} onChange={e => setMethod({ ...method, optimizationCriteria: e.target.value })} className="text-xs min-h-[50px]" />
                  <Textarea placeholder="Boas práticas internas" value={method.bestPractices ?? ''} onChange={e => setMethod({ ...method, bestPractices: e.target.value })} className="text-xs min-h-[50px]" />
                  <Button size="sm" variant="outline" onClick={handleSaveMethod} disabled={savingMethod}>
                    {savingMethod ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null} Salvar método
                  </Button>
                </div>
              )}

              <div className="relative">
                <Textarea
                  value={briefing}
                  onChange={e => setBriefing(e.target.value)}
                  placeholder="Briefing adicional (opcional) — ex.: foco em um lançamento, sazonalidade, restrição de orçamento..."
                  className="text-sm min-h-[60px] pr-10"
                />
                <VoiceInputButton
                  orgSlug={orgSlug}
                  onTranscribed={text => setBriefing(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                  disabled={generating}
                  className="absolute right-1 top-1 h-7 w-7"
                />
              </div>
              <Button size="sm" onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                Gerar sugestão de plano
              </Button>

              {suggestion && (
                <div className="border rounded-xl p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{suggestion.name}</div>
                      {suggestion.objective_primary && <div className="text-xs text-muted-foreground truncate">{suggestion.objective_primary}</div>}
                    </div>
                    {suggestion.budget_total_cents != null && (
                      <Badge variant="outline" className="shrink-0">{formatCurrency(suggestion.budget_total_cents)}</Badge>
                    )}
                  </div>

                  {suggestion.notes && <p className="text-xs text-muted-foreground italic">{suggestion.notes}</p>}

                  <div className="space-y-2">
                    {suggestion.campaigns.map((c, i) => (
                      <div key={i} className="border rounded-lg p-2 bg-background">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Badge variant="outline" className="text-[10px]">{PLATFORM_LABEL[c.platform]}</Badge>
                          <span className="truncate">{c.name}</span>
                          {c.budget_cents != null && <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatCurrency(c.budget_cents)}</span>}
                        </div>
                        <div className="pl-3 mt-1 space-y-1">
                          {c.adsets.map((a, j) => (
                            <div key={j} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{a.name}</span> — {a.ads.length} anúncio{a.ads.length === 1 ? '' : 's'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleApply} disabled={applying}>
                      {applying ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                      Aplicar como novo plano
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)} disabled={applying}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Descartar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
