'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Badge } from '@/components/ui/badge'
import { Bot, Plus, Trash2, Pencil, Play } from 'lucide-react'
import { createVoiceAgent, updateVoiceAgent, deleteVoiceAgent, listAvailableVoices, type VoiceAgentInput } from '@/actions/voice'
import type { ElevenLabsVoice } from '@/lib/voice/elevenlabs'

const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5', label: 'Claude Haiku (rápido)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet (mais inteligente)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-1.5-flash', label: 'Gemini Flash' },
]

const AVAILABLE_TOOLS = [
  { name: 'get_contact', label: 'Consultar dados do contato' },
  { name: 'get_contact_history', label: 'Consultar histórico' },
  { name: 'add_note', label: 'Registrar observação' },
  { name: 'create_task', label: 'Criar tarefa' },
  { name: 'update_pipeline_stage', label: 'Mover no pipeline' },
  { name: 'transfer_call', label: 'Transferir para humano' },
]

interface VoiceAgentRow {
  id: string
  name: string
  role_label: string | null
  objective?: string | null
  persona_prompt?: string | null
  tone?: string | null
  model: string
  voice?: string | null
  is_active: boolean
  allowed_tools: string[]
}

const EMPTY_FORM: VoiceAgentInput = { name: '', roleLabel: '', objective: '', personaPrompt: '', model: 'claude-haiku-4-5', voice: '', allowedTools: [] }

export function VoiceAgentsClient({ orgSlug, initialAgents }: { orgSlug: string; initialAgents: VoiceAgentRow[] }) {
  const [agents, setAgents] = useState(initialAgents)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<VoiceAgentInput>(EMPTY_FORM)
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [voicesConfigured, setVoicesConfigured] = useState(true)
  const [previewing, setPreviewing] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listAvailableVoices(orgSlug).then(res => {
      if (!res.ok) { toast.error(res.error); return }
      setVoicesConfigured(res.configured)
      setVoices(res.voices)
    })
  }, [open, orgSlug])

  function toggleTool(name: string) {
    setForm(f => ({ ...f, allowedTools: f.allowedTools.includes(name) ? f.allowedTools.filter(t => t !== name) : [...f.allowedTools, name] }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(a: VoiceAgentRow) {
    setEditingId(a.id)
    setForm({
      name: a.name,
      roleLabel: a.role_label ?? '',
      objective: a.objective ?? '',
      personaPrompt: a.persona_prompt ?? '',
      tone: a.tone ?? 'consultivo',
      model: a.model,
      voice: a.voice && a.voice !== 'default' ? a.voice : '',
      allowedTools: a.allowed_tools,
    })
    setOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error('Informe o nome do agente.'); return }
    startTransition(async () => {
      const res = editingId ? await updateVoiceAgent(orgSlug, editingId, form) : await createVoiceAgent(orgSlug, form)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(editingId ? 'Agente atualizado.' : 'Agente criado.')
      setOpen(false)
      window.location.reload()
    })
  }

  function playPreview(voice: ElevenLabsVoice) {
    if (!voice.previewUrl) return
    setPreviewing(voice.voiceId)
    const audio = new Audio(voice.previewUrl)
    audio.play().catch(() => {})
    audio.onended = () => setPreviewing(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteVoiceAgent(orgSlug, id)
      if (!res.ok) { toast.error(res.error); return }
      setAgents(a => a.filter(x => x.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingId(null) }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="w-4 h-4" /> Novo agente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? 'Editar agente' : 'Novo agente de Voice AI'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome (ex.: Júlia)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Função (ex.: SDR)" value={form.roleLabel} onChange={e => setForm(f => ({ ...f, roleLabel: e.target.value }))} />
              <Input placeholder="Objetivo" value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} />
              <textarea
                placeholder="Prompt de identidade/persona (opcional — se vazio, usamos um padrão a partir do nome/função/objetivo)"
                value={form.personaPrompt}
                onChange={e => setForm(f => ({ ...f, personaPrompt: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
              />
              <ResponsiveSelect className="w-full" value={form.model || 'claude-haiku-4-5'} onValueChange={v => setForm(f => ({ ...f, model: v }))} options={MODEL_OPTIONS} />

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Voz (ElevenLabs)</p>
                {!voicesConfigured ? (
                  <p className="text-xs text-muted-foreground">ElevenLabs não configurado ainda — cadastre a chave de API para escolher a voz do agente.</p>
                ) : voices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Carregando vozes...</p>
                ) : (
                  <div className="space-y-1.5">
                    <ResponsiveSelect
                      className="w-full"
                      value={form.voice || ''}
                      onValueChange={v => setForm(f => ({ ...f, voice: v }))}
                      options={voices.map(v => ({ value: v.voiceId, label: v.name }))}
                    />
                    {form.voice && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { const v = voices.find(x => x.voiceId === form.voice); if (v) playPreview(v) }}
                        disabled={previewing === form.voice}
                      >
                        <Play className="w-3 h-3" /> {previewing === form.voice ? 'Tocando...' : 'Ouvir prévia'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Ferramentas permitidas</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {AVAILABLE_TOOLS.map(t => (
                    <label key={t.name} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={form.allowedTools.includes(t.name)} onChange={() => toggleTool(t.name)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" disabled={pending} onClick={handleSave}>{pending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar agente'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Bot className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum agente de Voice AI criado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map(a => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5"><Bot className="w-4 h-4" /> {a.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(a)} className="text-muted-foreground hover:text-foreground" aria-label="Editar agente">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir agente">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {a.role_label && <p className="text-xs text-muted-foreground">{a.role_label}</p>}
                <Badge variant="outline" className="text-[10px]">{a.model}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
