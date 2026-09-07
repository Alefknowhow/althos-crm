'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, PauseCircle, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'
import {
  getDistributionConfig, updateDistributionSettings, upsertDistributionMember,
  type DistributionMember, type DistributionSettings,
} from '@/actions/pipeline-distribution'

export default function PipelineDistributionDialog({ orgSlug, pipelineId }: { orgSlug: string; pipelineId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canManage, setCanManage] = useState(true)
  const [settings, setSettings] = useState<DistributionSettings>({ enabled: false, first_stage_timeout_minutes: null })
  const [members, setMembers] = useState<DistributionMember[]>([])

  async function load() {
    setLoading(true)
    const res = await getDistributionConfig(orgSlug, pipelineId)
    setLoading(false)
    if (!res.ok) { toast.error(traduzirErro(res.error)); return }
    setSettings(res.settings)
    setMembers(res.members)
    setCanManage(res.canManage)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) load()
  }

  async function persistSettings(next: DistributionSettings) {
    setSettings(next)
    setSaving(true)
    const res = await updateDistributionSettings(orgSlug, pipelineId, {
      enabled: next.enabled,
      firstStageTimeoutMinutes: next.first_stage_timeout_minutes,
    })
    setSaving(false)
    if (!res.ok) toast.error(traduzirErro(res.error, 'Não foi possível salvar'))
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Users className="w-4 h-4 mr-1.5" /> Distribuição de leads
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Distribuição automática de leads</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Ativar distribuição automática</p>
                  <p className="text-xs text-muted-foreground">
                    Novos leads deste pipeline são atribuídos por peso relativo entre os membros abaixo, em vez de ficarem com quem os criou.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canManage || saving}
                  onClick={() => persistSettings({ ...settings, enabled: !settings.enabled })}
                  className={`shrink-0 ml-3 h-6 w-11 rounded-full transition-colors relative ${settings.enabled ? 'bg-primary' : 'bg-muted'}`}
                  aria-label="Ativar distribuição automática"
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reatribuir se ficar sem resposta no 1º estágio (minutos)
                </p>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage}
                  value={settings.first_stage_timeout_minutes ?? ''}
                  onChange={e => setSettings(s => ({ ...s, first_stage_timeout_minutes: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => persistSettings(settings)}
                  placeholder="Ex.: 30 — deixe vazio pra desligar"
                  className="h-9 w-48"
                />
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
