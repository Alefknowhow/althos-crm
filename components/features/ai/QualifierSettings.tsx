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
  const [prompt, setPrompt] = useState(initial.ai_qualifier_prompt || DEFAULT_QUALIFIER_PROMPT)
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  async function save() {
    setSaving(true)
    const res = await updateOrgAI(orgSlug, {
      ai_enabled: enabled,
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
