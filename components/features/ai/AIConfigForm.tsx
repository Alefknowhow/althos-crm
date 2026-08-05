'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, RotateCcw } from 'lucide-react'
import { updateOrgAI } from '@/actions/organization'
import { DEFAULT_QUALIFIER_PROMPT } from '@/lib/ai/qualifier-prompt'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Initial = {
  ai_enabled: boolean
  ai_provider: string
  ai_qualifier_model: string
  ai_qualifier_model_gemini: string
  ai_qualifier_prompt: string
  ai_business_context: string
  ocr_provider: 'claude' | 'gemini'
}

const OCR_PROVIDER_OPTIONS: { id: 'claude' | 'gemini'; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic) — padrão' },
  { id: 'gemini', label: 'Gemini 3.5 Flash-Lite (Google)' },
]

const CLAUDE_MODEL_OPTIONS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido, barato — recomendado)' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (mais preciso, mais caro)' },
]
const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (recomendado)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (mais rápido e barato, menos preciso)' },
]

const PROVIDER_OPTIONS: { id: 'claude' | 'gemini'; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic) — padrão' },
  { id: 'gemini', label: 'Gemini (Google)' },
]

export default function AIConfigForm({ orgSlug, initial }: { orgSlug: string; initial: Initial }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.ai_enabled)
  const [provider, setProvider] = useState<'claude' | 'gemini'>(initial.ai_provider === 'gemini' ? 'gemini' : 'claude')
  const [claudeModel, setClaudeModel] = useState(initial.ai_qualifier_model || 'claude-haiku-4-5')
  const [geminiModel, setGeminiModel] = useState(initial.ai_qualifier_model_gemini || 'gemini-3.6-flash')
  const [prompt, setPrompt] = useState(initial.ai_qualifier_prompt || DEFAULT_QUALIFIER_PROMPT)
  const [businessContext, setBusinessContext] = useState(initial.ai_business_context || '')
  const [ocrProvider, setOcrProvider] = useState<'claude' | 'gemini'>(initial.ocr_provider)
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const modelOptions = provider === 'gemini' ? GEMINI_MODEL_OPTIONS : CLAUDE_MODEL_OPTIONS
  const model = provider === 'gemini' ? geminiModel : claudeModel
  const setModel = provider === 'gemini' ? setGeminiModel : setClaudeModel

  async function save() {
    setSaving(true)
    const res = await updateOrgAI(orgSlug, {
      ai_enabled: enabled,
      ai_provider: provider,
      ai_qualifier_model: claudeModel,
      ai_qualifier_model_gemini: geminiModel,
      ai_qualifier_prompt: prompt,
      ai_business_context: businessContext,
      ocr_provider: ocrProvider,
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Configuração de IA salva')
      router.refresh()
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  function resetPrompt() {
    setShowResetConfirm(true)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Status da IA</CardTitle>
              <CardDescription>Ligue ou desligue a qualificação automática.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="ai-enabled" />
            <Label htmlFor="ai-enabled" className="cursor-pointer">
              {enabled ? 'IA ativa — leads novos são qualificados automaticamente' : 'IA pausada'}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motor de IA — qualificação de leads</CardTitle>
          <CardDescription>
            A IA do {' '}
            <span className="font-medium">Althos</span> já vem pronta para usar — você não precisa
            cadastrar nenhuma chave. O uso é controlado pelos créditos do seu plano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={provider}
              onChange={e => setProvider(e.target.value as 'claude' | 'gemini')}
            >
              {PROVIDER_OPTIONS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {modelOptions.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Modelos mais precisos consomem mais créditos por qualificação.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motor de IA — leitura de documentos (OCR)</CardTitle>
          <CardDescription>
            Escolha qual motor de IA processa a extração de dados de vouchers, orçamentos e reservas
            (PDF/imagem) em Reservas e Cotações. Não afeta a qualificação de leads acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={ocrProvider}
            onChange={e => setOcrProvider(e.target.value as 'claude' | 'gemini')}
          >
            {OCR_PROVIDER_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contexto do seu negócio</CardTitle>
          <CardDescription>
            Descreva o produto/serviço, o ICP (perfil de cliente ideal) e qualquer regra que a IA deve
            seguir. Quanto mais específico, melhor a qualificação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            placeholder="Exemplo: Sou agência de tráfego pago focada em clínicas de estética em SC. Ticket médio R$ 5k–10k/mês. ICP: clínicas com >2 funcionários, faturamento >R$ 50k/mês. Lead frio: empreendedores começando, sem orçamento. Lead quente: dono(a) de clínica há mais de 1 ano com Instagram ativo."
            value={businessContext}
            onChange={e => setBusinessContext(e.target.value)}
            className="resize-y font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Prompt da IA (avançado)</CardTitle>
            <CardDescription>
              O sistema instrucional que a IA segue. Mexa com cuidado — alterações ruins podem quebrar
              a saída JSON.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={resetPrompt}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar padrão
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={14}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="resize-y font-mono text-xs"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar prompt padrão?</AlertDialogTitle>
            <AlertDialogDescription>Suas alterações serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setPrompt(DEFAULT_QUALIFIER_PROMPT); setShowResetConfirm(false) }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
