'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateAutomation, toggleAutomation } from '@/actions/automations'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AutomationFlowCanvas from '@/components/features/automations/AutomationFlowCanvas'
import AutomationRunsPanel from '@/components/features/automations/AutomationRunsPanel'

function isInstagramTrigger(triggerType: string): boolean {
  return triggerType === 'instagram.dm.received' || triggerType === 'instagram.comment.received'
}

export default function AutomationEditor({ orgSlug, automation, forms, stages, runs, stepStats, whatsappTemplates, agentDefinitions, niche }: any) {
  const router = useRouter()
  const [auto, setAuto] = useState(automation)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const [togglingActive, setTogglingActive] = useState(false)

  // Persiste na hora, igual o toggle da lista (AutomationsShell.tsx) —
  // antes só atualizava o state local, e a mudança se perdia se o
  // usuário navegasse sem clicar em "Salvar Alterações" (bug real,
  // dois caminhos pro mesmo campo com comportamento diferente).
  async function handleToggleActive(checked: boolean) {
    setAuto((prev: any) => ({ ...prev, is_active: checked }))
    setTogglingActive(true)
    const res = await toggleAutomation(orgSlug, auto.id, checked)
    setTogglingActive(false)
    if (!res?.ok) {
      setAuto((prev: any) => ({ ...prev, is_active: !checked }))
      toast.error(res?.error || 'Erro ao atualizar status')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const hasInvalidInstagramStep = !isInstagramTrigger(auto.trigger_type)
        && (auto.steps || []).some((s: any) => s.type === 'send_instagram_dm')
      if (hasInvalidInstagramStep) {
        toast.error('Remova o passo "DM do Instagram" ou troque o gatilho pra um de Instagram antes de salvar.')
        setSaving(false)
        return
      }

      const res = await updateAutomation(orgSlug, auto.id, {
        name: auto.name,
        is_active: auto.is_active,
        trigger_type: auto.trigger_type,
        trigger_config: auto.trigger_config,
        steps: auto.steps,
        flow: auto.flow,
      })
      if (res?.ok) {
        toast.success('Automação salva')
        router.refresh()
      } else {
        toast.error(res?.error || 'Erro ao salvar automação')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar automação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-3 sm:p-4 border-b flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center bg-card   z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Input
            value={auto.name}
            onChange={e => setAuto({...auto, name: e.target.value})}
            className="font-bold border-transparent hover:border-input focus:border-input text-base sm:text-lg h-10 flex-1 min-w-0 lg:w-80 lg:flex-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={auto.is_active} onCheckedChange={handleToggleActive} disabled={togglingActive} />
            <Label className="text-sm cursor-pointer whitespace-nowrap">{auto.is_active ? 'Ativa' : 'Pausada'}</Label>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 lg:flex-none lg:w-[300px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="runs">Execuções</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleSave} disabled={saving} className="shrink-0">{saving ? 'Salvando...' : <span><span className="hidden sm:inline">Salvar Alterações</span><span className="sm:hidden">Salvar</span></span>}</Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative" style={{ height: 'calc(100vh - 205px)' }}>
        {activeTab === 'editor' && (
          <AutomationFlowCanvas auto={auto} setAuto={setAuto} forms={forms} stages={stages} stepStats={stepStats} whatsappTemplates={whatsappTemplates} agentDefinitions={agentDefinitions} niche={niche} />
        )}

        {activeTab === 'runs' && (
          <div className="h-full overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Execuções</h2>
                <p className="text-xs text-muted-foreground">
                  Acompanhe cada disparo desta automação passo a passo.
                </p>
              </div>
              <AutomationRunsPanel
                orgSlug={orgSlug}
                runs={runs || []}
                steps={auto.steps || []}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
