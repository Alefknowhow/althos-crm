'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, PauseCircle, PlayCircle, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'
import {
  getDistributionConfig, updateDistributionSettings, updateReassignmentEnabled,
  upsertReassignmentRule, removeReassignmentRule, upsertDistributionMember,
  type DistributionMember, type DistributionSettings, type ReassignmentRule, type PipelineStageOption,
} from '@/actions/pipeline-distribution'

export default function PipelineDistributionDialog({ orgSlug, pipelineId }: { orgSlug: string; pipelineId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canManage, setCanManage] = useState(true)
  const [settings, setSettings] = useState<DistributionSettings>({ enabled: false, reassignment_enabled: false })
  const [members, setMembers] = useState<DistributionMember[]>([])
  const [stages, setStages] = useState<PipelineStageOption[]>([])
  const [rules, setRules] = useState<ReassignmentRule[]>([])
  const [newRuleStage, setNewRuleStage] = useState('')
  const [newRuleMinutes, setNewRuleMinutes] = useState('')
  const [addingRule, setAddingRule] = useState(false)

  async function load() {
    setLoading(true)
    const res = await getDistributionConfig(orgSlug, pipelineId)
    setLoading(false)
    if (!res.ok) { toast.error(traduzirErro(res.error)); return }
    setSettings(res.settings)
    setMembers(res.members)
    setCanManage(res.canManage)
    setStages(res.stages)
    setRules(res.reassignmentRules)
    setNewRuleStage(res.stages[0]?.id ?? '')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) load()
  }

  async function toggleEnabled(next: boolean) {
    setSettings(s => ({ ...s, enabled: next }))
    setSaving(true)
    const res = await updateDistributionSettings(orgSlug, pipelineId, { enabled: next })
    setSaving(false)
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível salvar'))
      setSettings(s => ({ ...s, enabled: !next }))
    }
  }

  async function toggleReassignment(next: boolean) {
    setSettings(s => ({ ...s, reassignment_enabled: next }))
    setSaving(true)
    const res = await updateReassignmentEnabled(orgSlug, pipelineId, next)
    setSaving(false)
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível salvar'))
      setSettings(s => ({ ...s, reassignment_enabled: !next }))
    }
  }

  async function handleAddRule() {
    const minutes = Number(newRuleMinutes)
    if (!newRuleStage) { toast.error('Escolha um estágio.'); return }
    if (!minutes || minutes <= 0) { toast.error('Informe um tempo maior que zero.'); return }
    setAddingRule(true)
    const res = await upsertReassignmentRule(orgSlug, pipelineId, newRuleStage, minutes)
    setAddingRule(false)
    if (!res.ok) { toast.error(traduzirErro(res.error, 'Não foi possível salvar')); return }
    setNewRuleMinutes('')
    load()
  }

  async function handleRemoveRule(ruleId: string) {
    setRules(prev => prev.filter(r => r.id !== ruleId))
    const res = await removeReassignmentRule(orgSlug, ruleId)
    if (!res.ok) { toast.error(traduzirErro(res.error, 'Não foi possível remover')); load() }
  }

  function setLocalMember(userId: string, patch: Partial<DistributionMember>) {
    setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, ...patch } : m)))
  }

  async function persistMember(userId: string, patch: { weight?: number; paused?: boolean }) {
    const res = await upsertDistributionMember(orgSlug, pipelineId, userId, patch)
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível salvar'))
      load() // revert
    }
  }

  const usedStageIds = new Set(rules.map(r => r.stage_id))
  const availableStages = stages.filter(s => !usedStageIds.has(s.id))

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Users className="w-4 h-4 mr-1.5" /> Distribuição de leads
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Distribuição automática de leads</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-3">
                  <p className="text-sm font-medium">Ativar fila de distribuição</p>
                  <p className="text-xs text-muted-foreground">
                    Leads que entram automaticamente neste pipeline (formulário, WhatsApp, anúncios) são atribuídos por peso
                    relativo entre os membros abaixo. Leads criados manualmente sempre ficam com quem os criou.
                  </p>
                </div>
                <Switch checked={settings.enabled} onCheckedChange={toggleEnabled} disabled={!canManage || saving} />
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Reatribuir se ficar sem resposta</p>
                    <p className="text-xs text-muted-foreground">
                      Desligado por padrão. Ideal quando o 1º estágio é tratado pela IA e só cai pro humano depois — configure
                      abaixo, por estágio, quanto tempo sem interação até o lead voltar pra fila.
                    </p>
                  </div>
                  <Switch checked={settings.reassignment_enabled} onCheckedChange={toggleReassignment} disabled={!canManage || saving} />
                </div>

                {settings.reassignment_enabled && (
                  <div className="space-y-2 pt-1 border-t">
                    {rules.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5">
                        <span className="flex-1 min-w-0 truncate">{r.stage_name}</span>
                        <span className="text-muted-foreground shrink-0">{r.timeout_minutes} min</span>
                        <button type="button" disabled={!canManage} onClick={() => handleRemoveRule(r.id)} className="shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Remover regra">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {canManage && availableStages.length > 0 && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <Select value={newRuleStage} onValueChange={setNewRuleStage}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Estágio" /></SelectTrigger>
                            <SelectContent>
                              {availableStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          type="number" min={1} placeholder="Minutos" value={newRuleMinutes}
                          onChange={e => setNewRuleMinutes(e.target.value)}
                          className="h-9 w-24"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={handleAddRule} disabled={addingRule}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {rules.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhuma regra configurada ainda.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Membros na fila (peso relativo)
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {members.map(m => (
                    <div key={m.user_id} className={`flex items-center gap-2 rounded-lg border p-2 ${m.paused ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.assigned_count} lead(s) recebido(s) por aqui</p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        disabled={!canManage}
                        value={m.weight}
                        onChange={e => setLocalMember(m.user_id, { weight: Math.max(1, Number(e.target.value) || 1) })}
                        onBlur={() => persistMember(m.user_id, { weight: m.weight })}
                        className="h-8 w-16 text-sm text-center"
                        title="Peso relativo"
                      />
                      <button
                        type="button"
                        disabled={!canManage}
                        title={m.paused ? 'Retomar recebimento' : 'Pausar recebimento'}
                        onClick={() => { setLocalMember(m.user_id, { paused: !m.paused }); persistMember(m.user_id, { paused: !m.paused }) }}
                        className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {m.paused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                      </button>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro na organização.</p>
                  )}
                </div>
              </div>

              {!canManage && (
                <p className="text-xs text-muted-foreground">Só o dono ou administradores podem alterar essa configuração.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
