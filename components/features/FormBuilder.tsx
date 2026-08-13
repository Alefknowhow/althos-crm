'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateForm } from '@/actions/forms'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import FormToolbar from './formbuilder/FormToolbar'
import PagesSidebar from './formbuilder/PagesSidebar'
import PreviewPane from './formbuilder/PreviewPane'
import PropertiesPanel from './formbuilder/PropertiesPanel'
import SettingsSheet from './formbuilder/SettingsSheet'
import type { ActivePageId } from './formbuilder/types'

export default function FormBuilder({ orgSlug, initialForm, pipelines, stages, eventTypes = [] }: any) {
  const [form, setForm] = useState(initialForm)
  const [schema, setSchema] = useState(initialForm.schema || { fields: [] })
  const [saving, setSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Página selecionada no editor: 'welcome' | id do campo | 'ending'.
  const [activePageId, setActivePageId] = useState<ActivePageId>(
    schema.welcome?.enabled ? 'welcome' : (schema.fields[0]?.id ?? 'ending')
  )

  // Raw text da textarea de opções — evita trim/filter agressivo a cada tecla.
  const [rawOptions, setRawOptions] = useState<string>('')

  const selectedField = schema.fields.find((f: any) => f.id === activePageId) || null
  const fieldIndex = schema.fields.findIndex((f: any) => f.id === activePageId) + 1

  function selectPage(id: ActivePageId) {
    setActivePageId(id)
    const field = schema.fields.find((f: any) => f.id === id)
    setRawOptions(field?.options?.join('\n') ?? '')
  }

  function addField(type: string) {
    const def = { id: `field_${Date.now()}`, type, label: 'Nova pergunta', required: false }
    setSchema({ ...schema, fields: [...schema.fields, def] })
    selectPage(def.id)
  }

  function updateSelectedField(updates: any) {
    if (!selectedField) return
    const updated = { ...selectedField, ...updates }
    setSchema({
      ...schema,
      fields: schema.fields.map((f: any) => (f.id === updated.id ? updated : f)),
    })
  }

  function commitOptions() {
    const opts = rawOptions.split('\n').map((s: string) => s.trim()).filter(Boolean)
    updateSelectedField({ options: opts })
  }

  function reorderFields(fromId: string, toId: string) {
    setSchema((prev: any) => {
      const oldIndex = prev.fields.findIndex((f: any) => f.id === fromId)
      const newIndex = prev.fields.findIndex((f: any) => f.id === toId)
      return { ...prev, fields: arrayMove(prev.fields, oldIndex, newIndex) }
    })
  }

  function enableWelcome() {
    setSchema({ ...schema, welcome: { ...(schema.welcome || {}), enabled: true } })
    setActivePageId('welcome')
  }

  async function handleSave() {
    setSaving(true)
    // `name` é gerenciado pelo FormPageHeader (rename inline) — não mandamos
    // aqui pra não sobrescrever um rename recente com um valor obsoleto.
    await updateForm(orgSlug, form.id, {
      schema,
      pipeline_id: form.pipeline_id,
      stage_id: form.stage_id,
      is_active: form.is_active,
    })
    setSaving(false)
    toast.success('Formulário salvo!')
  }

  // ── Editor de URL pública ────────────────────────────────────────────────
  const [editingUrl, setEditingUrl] = useState(false)
  const [slugDraft, setSlugDraft] = useState(form.slug)
  const [savingUrl, setSavingUrl] = useState(false)

  function slugify(v: string) {
    return v
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function handleSaveUrl() {
    const clean = slugify(slugDraft)
    if (!clean) {
      toast.error('URL inválida')
      return
    }
    setSavingUrl(true)
    const res = await updateForm(orgSlug, form.id, { slug: clean })
    setSavingUrl(false)
    if ((res as any)?.ok === false) {
      toast.error((res as any).error || 'Erro ao salvar URL')
      return
    }
    setForm({ ...form, slug: clean })
    setSlugDraft(clean)
    setEditingUrl(false)
    toast.success('URL atualizada!')
  }

  return (
    <div className="flex flex-col w-full h-full text-foreground bg-background">
      <FormToolbar
        form={form}
        setForm={setForm}
        schema={schema}
        setSchema={setSchema}
        saving={saving}
        onSave={handleSave}
        onAddField={addField}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenUrlEditor={() => { setSlugDraft(form.slug); setEditingUrl(true) }}
      />

      <div className="flex flex-1 min-h-0">
        <PagesSidebar
          fields={schema.fields}
          welcomeEnabled={!!schema.welcome?.enabled}
          activePageId={activePageId}
          onSelect={selectPage}
          onReorder={reorderFields}
          onAddField={addField}
          onEnableWelcome={enableWelcome}
        />

        <PreviewPane schema={schema} activePageId={activePageId} fieldIndex={fieldIndex} />

        <PropertiesPanel
          orgSlug={orgSlug}
          activePageId={activePageId}
          schema={schema}
          setSchema={setSchema}
          selectedField={selectedField}
          rawOptions={rawOptions}
          setRawOptions={setRawOptions}
          onCommitOptions={commitOptions}
          onUpdateField={updateSelectedField}
          eventTypes={eventTypes}
        />
      </div>

      <SettingsSheet
        orgSlug={orgSlug}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        schema={schema}
        setSchema={setSchema}
        form={form}
        setForm={setForm}
        pipelines={pipelines}
        stages={stages}
      />

      {editingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingUrl(false)}>
          <div className="bg-background rounded-none border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-base">Editar URL pública</h3>
              <p className="text-xs text-muted-foreground mt-1">Esse é o endereço do seu formulário público.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Endereço</Label>
              <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 focus-within:ring-1 focus-within:ring-ring">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/f/</span>
                <Input
                  autoFocus
                  value={slugDraft}
                  onChange={e => setSlugDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveUrl() }}
                  className="border-0 bg-transparent px-1 h-9 focus-visible:ring-0 shadow-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">Ficará: <span className="font-mono">/f/{slugify(slugDraft) || '...'}</span></p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditingUrl(false)} disabled={savingUrl}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveUrl} disabled={savingUrl}>{savingUrl ? 'Salvando...' : 'Salvar URL'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
