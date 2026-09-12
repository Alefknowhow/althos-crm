'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStage, updateStage, deleteStage, savePipelineMetaConfig } from '@/actions/pipeline'
import { Trophy, ThumbsDown, Trash2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

export default function PipelineConfigDialog({ orgSlug, pipeline, stages }: any) {
  const [open, setOpen]           = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [loading, setLoading]     = useState<string | null>(null)
  // Local mirror so toggles reflect instantly (optimistic), then reconcile
  // with the server-revalidated props.
  const [localStages, setLocalStages] = useState<any[]>(stages)
  useEffect(() => { setLocalStages(stages) }, [stages])

  const [pixelId, setPixelId] = useState(pipeline.meta_pixel_id || '')
  const [accessToken, setAccessToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  useEffect(() => { setPixelId(pipeline.meta_pixel_id || '') }, [pipeline.meta_pixel_id])

  async function handleSaveMeta() {
    setSavingMeta(true)
    const res = await savePipelineMetaConfig(orgSlug, pipeline.id, {
      meta_pixel_id: pixelId.trim(),
      meta_access_token: accessToken.trim() || undefined,
    })
    setSavingMeta(false)
    if (res.ok) {
      toast.success('Pixel/CAPI deste pipeline salvo!')
      setAccessToken('')
    } else {
      toast.error(traduzirErro(res.error, 'Erro ao salvar'))
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newStageName) return
    await createStage(orgSlug, pipeline.id, newStageName, '#94a3b8')
    setNewStageName('')
  }

  function setLocalColor(stageId: string, color: string) {
    setLocalStages(prev => prev.map(s => (s.id === stageId ? { ...s, color } : s)))
  }

  async function persistColor(stageId: string, color: string) {
    const res = await updateStage(orgSlug, stageId, { color })
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível atualizar a cor'))
      setLocalStages(stages) // revert
    }
  }

  function setLocalName(stageId: string, name: string) {
    setLocalStages(prev => prev.map(s => (s.id === stageId ? { ...s, name } : s)))
  }

  async function persistName(stageId: string, name: string) {
    const trimmed = name.trim()
    const original = stages.find((s: any) => s.id === stageId)?.name ?? ''
    if (!trimmed) {
      setLocalStages(prev => prev.map(s => (s.id === stageId ? { ...s, name: original } : s))) // sem nome vazio
      return
    }
    if (trimmed === original) return
    const res = await updateStage(orgSlug, stageId, { name: trimmed })
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível renomear o estágio'))
      setLocalStages(prev => prev.map(s => (s.id === stageId ? { ...s, name: original } : s))) // revert
    } else {
      setLocalStages(prev => prev.map(s => (s.id === stageId ? { ...s, name: trimmed } : s)))
    }
  }

  async function toggleFlag(stageId: string, flag: 'is_won' | 'is_lost', current: boolean) {
    const next = !current
    setLoading(`${stageId}-${flag}`)
    // Optimistic: flip the flag locally and clear the opposite one (mutually exclusive).
    setLocalStages(prev => prev.map(s => {
      if (s.id !== stageId) return s
      const updated = { ...s, [flag]: next }
      if (next) updated[flag === 'is_won' ? 'is_lost' : 'is_won'] = false
      return updated
    }))
    const res = await updateStage(orgSlug, stageId, { [flag]: next })
    setLoading(null)
    if (!res.ok) {
      toast.error(traduzirErro(res.error, 'Não foi possível atualizar o estágio'))
      setLocalStages(stages) // revert
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Configurar Pipeline</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estágios do Pipeline</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-1">
            Marque <span className="font-medium text-emerald-600">Ganho</span> para disparar o evento{' '}
            <strong>Purchase</strong> na Meta CAPI quando um lead entrar nesse estágio.
            Marque <span className="font-medium text-destructive">Perdido</span> para disparar{' '}
            <strong>NotQualified</strong>.
          </p>

          <div className="space-y-2 py-2 max-h-[52vh] overflow-y-auto">
            {localStages.map((s: any) => (
              <div key={s.id} className="flex gap-2 items-center bg-muted/50 px-3 py-2 rounded-lg">
                {/* colour picker — click the dot to open the native colour picker */}
                <label
                  className="relative w-5 h-5 rounded-full border shrink-0 cursor-pointer"
                  style={{ backgroundColor: s.color || '#94a3b8' }}
                  title="Alterar cor do estágio"
                >
                  <input
                    type="color"
                    value={s.color || '#94a3b8'}
                    onChange={e => setLocalColor(s.id, e.target.value)}
                    onBlur={e => persistColor(s.id, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>

                {/* name — clique pra editar */}
                <Input
                  value={s.name}
                  onChange={e => setLocalName(s.id, e.target.value)}
                  onBlur={e => persistName(s.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="flex-1 h-7 text-sm font-medium border-transparent bg-transparent px-1.5 hover:border-input focus-visible:border-b-primary"
                  aria-label="Nome do estágio"
                />

                {/* Ganho toggle */}
                <button
                  type="button"
                  disabled={loading === `${s.id}-is_won`}
                  onClick={() => toggleFlag(s.id, 'is_won', !!s.is_won)}
                  title="Marcar como estágio de Ganho"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                    s.is_won
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20',
                  )}
                >
                  <Trophy className="w-3 h-3" />
                  Ganho
                </button>

                {/* Perdido toggle */}
                <button
                  type="button"
                  disabled={loading === `${s.id}-is_lost`}
                  onClick={() => toggleFlag(s.id, 'is_lost', !!s.is_lost)}
                  title="Marcar como estágio de Perdido"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                    s.is_lost
                      ? 'bg-red-100 text-destructive dark:bg-red-900/40 dark:text-red-400'
                      : 'bg-muted text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-900/20',
                  )}
                >
                  <ThumbsDown className="w-3 h-3" />
                  Perdido
                </button>

                {/* Delete */}
                <button
                  type="button"
                  title="Excluir estágio"
                  onClick={async () => {
                    const res = await deleteStage(orgSlug, s.id)
                    if (!res.ok) toast.error(traduzirErro(res.error))
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAdd} className="flex gap-2 border-t pt-3">
            <Input
              placeholder="Nome do novo estágio"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
            />
            <Button type="submit">Adicionar</Button>
          </form>

          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-medium">Pixel/CAPI (Meta) deste pipeline</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Facebook Pixel ID</Label>
              <Input
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              {pipeline.has_meta_access_token && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Token configurado. Cole um novo abaixo para atualizar.
                </div>
              )}
              <Label className="text-xs">{pipeline.has_meta_access_token ? 'Novo token (deixe vazio para manter)' : 'Access Token (CAPI)'}</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder={pipeline.has_meta_access_token ? '••••••••••••••' : 'EAAxxxxx...'}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? 'Salvando...' : 'Salvar Pixel/CAPI'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
