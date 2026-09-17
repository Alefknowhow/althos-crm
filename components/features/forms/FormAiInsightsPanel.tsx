'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { getFormAiInsights, type FormAiInsights } from '@/actions/forms-ai-insights'

/**
 * "Gerar insights com IA" — sob demanda, na tela de respostas de um
 * formulário. Não roda sozinho (evita gastar crédito de IA à toa); o
 * usuário pede quando quiser, e pode pedir de novo pra atualizar.
 */
export default function FormAiInsightsPanel({ orgSlug, formId }: { orgSlug: string; formId: string }) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<FormAiInsights | null>(null)

  async function handleGenerate() {
    setLoading(true)
    const res = await getFormAiInsights(orgSlug, formId)
    setLoading(false)
    if (!res.ok) { toast.error(res.error); return }
    setInsights(res.insights)
  }

  if (!insights) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-card text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-muted/50 disabled:opacity-60 shrink-0"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {loading ? 'Gerando insights...' : 'Gerar insights com IA'}
      </button>
    )
  }

  return (
    <div className="rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-primary" />
          Insights da IA
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar
        </button>
      </div>

      <p className="text-sm text-foreground">{insights.summary}</p>

      {insights.patterns.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Padrões observados</p>
          <ul className="space-y-1">
            {insights.patterns.map((p, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-muted-foreground shrink-0">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sugestões</p>
          <ul className="space-y-1">
            {insights.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
