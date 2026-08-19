'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RotateCcw } from 'lucide-react'
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
}

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

/**
 * Qualificação automática de leads — um recurso separado do Agente IA de
 * atendimento (roda sobre o formulário/dados do lead, não numa conversa em
 * tempo real). Fica como uma aba dentro de Agente IA porque usa o mesmo
 * modelo Claude (ai_qualifier_model, compartilhado — ver actions/organization.ts)
 * quando o provedor é Claude; o "Contexto do negócio" também é compartilhado
 * e fica só na aba Personalidade, pra não ter dois lugares editando o mesmo
 * texto (era exatamente esse o bug corrigido antes).
 */
export default function QualifierSettings({ orgSlug, initial }: { orgSlug: string; initial: Initial }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.ai_enabled)
  const [provider, setProvider] = useState<'claude' | 'gemini'>(initial.ai_provider === 'gemini' ? 'gemini' : 'claude')
  const [claudeModel, setClaudeModel] = useState(initial.ai_qualifier_model || 'claude-haiku-4-5')
  const [geminiModel, setGeminiModel] = useState(initial.ai_qualifier_model_gemini || 'gemini-3.6-flash')
  const [prompt, setPrompt] = useState(initial.ai_qualifier_prompt || DEFAULT_QUALIFIER_PROMPT)
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
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Configuração de qualificação salva')
      router.refresh()
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Qualificação automática de leads</CardTitle>
          <CardDescription>
            Roda sobre o cadastro do lead (não é uma conversa) e atribui score/tags automaticamente
            quando um lead novo entra. É um recurso separado do Agente de atendimento (aba Personalidade).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="qualifier-enabled" />
            <Label htmlFor="qualifier-enabled" className="cursor-pointer">
              {enabled ? 'Ativa — leads novos são qualificados automaticamente' : 'Pausada'}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motor de IA</CardTitle>
          <CardDescription>
            A IA do Althos já vem pronta pra usar — sem precisar cadastrar chave. O uso é controlado
            pelos créditos do seu plano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
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
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {modelOptions.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {provider === 'claude' && (
              <p className="text-xs text-muted-foreground">
                Esse é o mesmo modelo Claude usado pelo Agente de atendimento (aba Personalidade).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Prompt de qualificação (avançado)</CardTitle>
            <CardDescription>
              O sistema instrucional que a IA segue pra pontuar o lead. Mexa com cuidado — alterações
              ruins podem quebrar a saída JSON.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)}>
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
          {saving ? 'Salvando...' : 'Salvar qualificação'}
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
            <AlertDialogAction onClick={() => { setPrompt(DEFAULT_QUALIFIER_PROMPT); setShowResetConfirm(false) }}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
