'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, RotateCcw, MessageCircle, Sparkles } from 'lucide-react'
import { updateAttendantConfig, type AttendantConfig } from '@/actions/ai_attendant'
import {
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_OUT_OF_HOURS_MESSAGE,
  DAY_LABELS,
} from '@/lib/ai/attendant-defaults'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido, barato — recomendado)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (mais preciso, ~3x mais caro)' },
]

const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] // Seg → Dom

export default function AttendantConfigForm({
  orgSlug,
  initial,
}: {
  orgSlug: string
  initial: AttendantConfig
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [enabled, setEnabled] = useState(initial.is_enabled)
  const [persona, setPersona] = useState(initial.persona_prompt)
  const [business, setBusiness] = useState(initial.business_context)
  const [model, setModel] = useState(initial.model)
  const [outOfHours, setOutOfHours] = useState(initial.out_of_hours_message)
  const [phrases, setPhrases] = useState((initial.handoff_phrases || []).join(', '))
  const [maxReplies, setMaxReplies] = useState(initial.max_replies_per_conversation)
  const [hours, setHours] = useState<Record<string, [number, number] | null>>(() => {
    // Normalize: ensure every weekday has either a tuple or null.
    const out: Record<string, [number, number] | null> = {}
    for (const k of WEEKDAY_ORDER) {
      const v = (initial.working_hours as any)[k]
      out[k] = Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null
    }
    return out
  })

  async function save() {
    setSaving(true)
    const res = await updateAttendantConfig(orgSlug, {
      is_enabled: enabled,
      persona_prompt: persona,
      business_context: business,
      model,
      out_of_hours_message: outOfHours,
      handoff_phrases: phrases
        .split(',')
        .map(p => p.trim())
        .filter(Boolean),
      max_replies_per_conversation: maxReplies,
      working_hours: Object.fromEntries(
        Object.entries(hours).filter(([, v]) => v !== null),
      ) as any,
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Configuração salva')
      router.refresh()
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  function resetPersona() {
    setShowResetConfirm(true)
  }

  function toggleDay(key: string) {
    setHours(prev => ({
      ...prev,
      [key]: prev[key] ? null : [9, 18],
    }))
  }

  function changeHour(key: string, idx: 0 | 1, val: number) {
    setHours(prev => {
      const cur = prev[key] || [9, 18]
      const next: [number, number] = idx === 0 ? [val, cur[1]] : [cur[0], val]
      return { ...prev, [key]: next }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Status do Atendente</CardTitle>
              <CardDescription>Liga ou desliga o atendente como um todo.</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? 'Ligado — o atendente responderá conversas pelo WhatsApp (quando a API estiver conectada) e pelo Playground.'
              : 'Desligado — só funciona no Playground, ignorando mensagens reais.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persona</CardTitle>
          <CardDescription>
            A personalidade e regras do atendente. Use o template e ajuste para o tom da sua agência/cliente.
            Variáveis disponíveis: <code>{'{{org_nome}}'}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={20}
            value={persona}
            onChange={e => setPersona(e.target.value)}
            className="font-mono text-xs resize-y"
          />
          <Button variant="ghost" size="sm" onClick={resetPersona} className="mt-2">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar padrão
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contexto do negócio</CardTitle>
          <CardDescription>
            Descreva produto/serviço, ICP, faixa de preço, diferenciais. Esse texto fica sempre no
            contexto, mas para FAQ detalhada, use a{' '}
            <Link
              href={`/app/${orgSlug}/configuracoes/atendente-ia/faq`}
              className="underline"
            >
              Base de Conhecimento
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            value={business}
            onChange={e => setBusiness(e.target.value)}
            placeholder="Ex: Clínica de estética em Florianópolis. Atende botox, preenchimento, harmonização. Ticket médio R$ 800-2500. Atendemos das 9h às 19h. Diferencial: equipe formada por médicos."
            className="font-mono text-xs resize-y"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horário de atendimento</CardTitle>
          <CardDescription>
            Fora desses horários, o atendente responde apenas com a mensagem de "fora do horário"
            abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAY_ORDER.map(k => {
            const range = hours[k]
            return (
              <div key={k} className="flex items-center gap-3">
                <Switch checked={!!range} onCheckedChange={() => toggleDay(k)} />
                <span className="text-sm w-20">{DAY_LABELS[k]}</span>
                {range ? (
                  <>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={range[0]}
                      onChange={e => changeHour(k, 0, parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <span className="text-muted-foreground text-xs">às</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={range[1]}
                      onChange={e => changeHour(k, 1, parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Fechado</span>
                )}
              </div>
            )
          })}

          <div className="space-y-2 pt-2 border-t">
            <Label>Mensagem fora do horário</Label>
            <Textarea
              rows={3}
              value={outOfHours}
              onChange={e => setOutOfHours(e.target.value)}
              placeholder={DEFAULT_OUT_OF_HOURS_MESSAGE}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalação para humano</CardTitle>
          <CardDescription>
            Palavras-chave que, se aparecerem na mensagem do cliente, escalam a conversa para humano
            imediatamente (separadas por vírgula).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={phrases}
            onChange={e => setPhrases(e.target.value)}
            placeholder="humano, atendente, responsável, reclamação"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avançado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Máximo de respostas por conversa</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={maxReplies}
              onChange={e => setMaxReplies(parseInt(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">
              Anti-loop: após esse número de respostas, a conversa para de ser respondida automaticamente
              e é escalada para humano.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between sticky bottom-4 bg-card border rounded-lg px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/app/${orgSlug}/configuracoes/atendente-ia/faq`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-3.5 h-3.5" /> Base de Conhecimento
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/app/${orgSlug}/atendente-ia/teste`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Testar no Playground
          </Link>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar persona padrão?</AlertDialogTitle>
            <AlertDialogDescription>Suas alterações serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setPersona(DEFAULT_PERSONA_PROMPT); setShowResetConfirm(false) }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
