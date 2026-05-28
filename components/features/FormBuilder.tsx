'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateForm } from '@/actions/forms'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import PublicFormPreview from './PublicFormPreview'
import OneQuestionForm from './OneQuestionForm'
import ImageUploadButton from './ImageUploadButton'

function SortableField({ field, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-card border rounded-md mb-2 group shadow-sm hover:border-primary/50 transition-colors">
      <div {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground hover:text-foreground">⋮⋮</div>
      <div className="flex-1 text-sm font-medium">
        {field.label} {field.required && <span className="text-destructive">*</span>}
        <div className="text-xs text-muted-foreground mt-0.5">{field.type}</div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => onEdit(field)}>Editar</Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(field.id)}>X</Button>
      </div>
    </div>
  )
}

export default function FormBuilder({ orgSlug, initialForm, pipelines, stages, eventTypes = [] }: any) {
  const [form, setForm] = useState(initialForm)
  const [schema, setSchema] = useState(initialForm.schema || { fields: [] })
  const [selectedField, setSelectedField] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (active.id !== over?.id && over) {
      setSchema((prev: any) => {
        const oldIndex = prev.fields.findIndex((f: any) => f.id === active.id)
        const newIndex = prev.fields.findIndex((f: any) => f.id === over.id)
        return { ...prev, fields: arrayMove(prev.fields, oldIndex, newIndex) }
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    await updateForm(orgSlug, form.id, { 
      name: form.name, 
      schema, 
      pipeline_id: form.pipeline_id, 
      stage_id: form.stage_id,
      is_active: form.is_active 
    })
    setSaving(false)
  }

  const addField = (type: string) => {
    const newField = { id: `field_${Date.now()}`, type, label: `Novo Campo ${type}`, required: false }
    setSchema({ ...schema, fields: [...schema.fields, newField] })
  }

  const updateSelectedField = (updates: any) => {
    const updated = { ...selectedField, ...updates }
    setSelectedField(updated)
    setSchema({
      ...schema,
      fields: schema.fields.map((f: any) => f.id === updated.id ? updated : f)
    })
  }

  return (
    <div className="flex w-full h-full text-foreground bg-background">
      <div className="w-1/2 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b bg-background flex justify-between items-center shadow-sm z-10 shrink-0">
          <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="font-bold border-transparent hover:border-input focus:border-input w-1/2 text-lg h-10" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
               <Label className="text-xs text-muted-foreground">Ativo</Label>
               <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" />
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`)
              alert('URL Copiada!')
            }}>Copiar URL</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 flex gap-6">
          <div className="flex-1 space-y-8">
            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <h3 className="font-semibold text-sm">Modo de Exibição</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSchema({ ...schema, mode: 'classic' })}
                  className={`p-3 border rounded-md text-left transition-colors ${(schema.mode || 'classic') === 'classic' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                >
                  <div className="font-medium text-sm">Clássico</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Todos os campos numa página</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSchema({ ...schema, mode: 'one_question' })}
                  className={`p-3 border rounded-md text-left transition-colors ${schema.mode === 'one_question' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                >
                  <div className="font-medium text-sm">Uma pergunta por vez</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Estilo Typeform, com progresso</div>
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Tela de Boas-Vindas</h3>
                <input
                  type="checkbox"
                  checked={!!schema.welcome?.enabled}
                  onChange={e => setSchema({ ...schema, welcome: { ...(schema.welcome || {}), enabled: e.target.checked } })}
                  className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
              </div>
              {schema.welcome?.enabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título</Label>
                    <Input
                      value={schema.welcome?.title || ''}
                      onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, title: e.target.value } })}
                      placeholder="Ex: Vamos te conhecer melhor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição (contexto)</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={schema.welcome?.description || ''}
                      onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, description: e.target.value } })}
                      placeholder="Explique brevemente o objetivo do formulário..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texto do botão</Label>
                    <Input
                      value={schema.welcome?.buttonText || ''}
                      onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, buttonText: e.target.value } })}
                      placeholder="Começar"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Botão WhatsApp (alternativa)</h3>
                <input
                  type="checkbox"
                  checked={!!schema.whatsapp?.enabled}
                  onChange={e => setSchema({ ...schema, whatsapp: { ...(schema.whatsapp || {}), enabled: e.target.checked } })}
                  className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
              </div>
              {schema.whatsapp?.enabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número (com DDI, só dígitos)</Label>
                    <Input
                      value={schema.whatsapp?.phone || ''}
                      onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, phone: e.target.value } })}
                      placeholder="5547999999999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mensagem pré-preenchida</Label>
                    <Input
                      value={schema.whatsapp?.message || ''}
                      onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, message: e.target.value } })}
                      placeholder="Olá! Vim do formulário e gostaria de mais informações."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texto do botão</Label>
                    <Input
                      value={schema.whatsapp?.label || ''}
                      onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, label: e.target.value } })}
                      placeholder="Falar no WhatsApp"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Booking CTA: aparece DEPOIS do envio, na tela de sucesso.
                Ideal pra direcionar o lead direto para marcar avaliação/consulta. */}
            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Botão de Agendamento (após envio)</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Aparece na tela de sucesso, levando ao link público de agendamento.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!schema.booking?.enabled}
                  onChange={e =>
                    setSchema({
                      ...schema,
                      booking: { ...(schema.booking || {}), enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
              </div>
              {schema.booking?.enabled && (
                <div className="space-y-3">
                  {eventTypes.length === 0 ? (
                    <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                      Nenhum tipo de evento ativo encontrado em Agendamentos. Crie pelo menos um pra
                      poder usar essa opção.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de evento para o qual o botão leva</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                          value={schema.booking?.eventTypeSlug || ''}
                          onChange={e =>
                            setSchema({
                              ...schema,
                              booking: { ...schema.booking, eventTypeSlug: e.target.value },
                            })
                          }
                        >
                          <option value="">Selecione o tipo de evento</option>
                          {eventTypes.map((et: any) => (
                            <option key={et.slug} value={et.slug}>
                              {et.name} ({et.duration_minutes} min)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Texto do botão</Label>
                        <Input
                          value={schema.booking?.label || ''}
                          onChange={e =>
                            setSchema({
                              ...schema,
                              booking: { ...schema.booking, label: e.target.value },
                            })
                          }
                          placeholder="Consultar horários disponíveis para agendamento"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Assinatura do rodapé ────────────────── */}
            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Assinatura do Rodapé</h3>
                  <p className="text-[11px] text-muted-foreground">Logo e nome exibidos no final do formulário.</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!schema.signature?.enabled}
                  onChange={e => setSchema({ ...schema, signature: { ...(schema.signature || {}), enabled: e.target.checked } })}
                  className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
              </div>
              {schema.signature?.enabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Logo</Label>
                    <ImageUploadButton
                      orgSlug={orgSlug}
                      value={schema.signature?.logoUrl}
                      onChange={url =>
                        setSchema({ ...schema, signature: { ...schema.signature, logoUrl: url } })
                      }
                      previewHeight="max-h-20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome / Slogan</Label>
                    <Input
                      value={schema.signature?.name || ''}
                      onChange={e => setSchema({ ...schema, signature: { ...schema.signature, name: e.target.value } })}
                      placeholder="Ex: Althos Performance"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Meta Pixel ─────────────────────────── */}
            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <div>
                <h3 className="font-semibold text-sm">Meta Pixel / CAPI</h3>
                <p className="text-[11px] text-muted-foreground">
                  Configure o Pixel ID e o Access Token em{' '}
                  <strong>Configurações → Meta</strong> da organização.
                  Quando configurados, o evento <em>Lead</em> é enviado
                  automaticamente via Pixel (cliente) e CAPI (servidor) ao submeter o formulário.
                </p>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-xl bg-background shadow-sm">
              <h3 className="font-semibold text-sm">Destino do Lead</h3>
              <div className="grid grid-cols-2 gap-4">
                <select className="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm bg-background cursor-pointer" value={form.pipeline_id || ''} onChange={e => setForm({...form, pipeline_id: e.target.value})}>
                  <option value="">Selecione o Pipeline</option>
                  {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm bg-background cursor-pointer" value={form.stage_id || ''} onChange={e => setForm({...form, stage_id: e.target.value})}>
                  <option value="">Selecione o Estágio</option>
                  {stages.filter((s:any) => s.pipeline_id === form.pipeline_id).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Campos do Formulário</h3>
                <select className="h-8 text-xs border rounded-md px-2 bg-background cursor-pointer font-medium" onChange={e => { if(e.target.value) { addField(e.target.value); e.target.value = '' }}}>
                  <option value="">+ Adicionar Campo</option>
                  <option value="single_choice">Múltipla Escolha (cards)</option>
                  <option value="short_text">Texto Curto</option>
                  <option value="long_text">Texto Longo</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="number">Número</option>
                  <option value="select">Select (Dropdown)</option>
                  <option value="multi_select">Múltipla Escolha (várias)</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>

              <div className="min-h-[200px]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={schema.fields.map((f:any) => f.id)} strategy={verticalListSortingStrategy}>
                    {schema.fields.map((f: any) => (
                      <SortableField key={f.id} field={f} onEdit={setSelectedField} onDelete={(id: string) => {
                        setSchema({ ...schema, fields: schema.fields.filter((field:any) => field.id !== id) })
                        if(selectedField?.id === id) setSelectedField(null)
                      }} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              
              <div className="space-y-2 pt-6 border-t">
                <Label>Texto do Botão de Envio</Label>
                <Input value={schema.submitButtonText || 'Enviar'} onChange={e => setSchema({...schema, submitButtonText: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Mensagem de Sucesso</Label>
                <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={schema.thankYouMessage || ''} onChange={e => setSchema({...schema, thankYouMessage: e.target.value})} />
              </div>
            </div>
          </div>
          
          {selectedField && (
            <div className="w-72 bg-background border rounded-xl p-4 space-y-4 shrink-0 shadow-lg self-start sticky top-0">
              <div className="flex justify-between items-center border-b pb-2 mb-2">
                <h4 className="font-semibold text-sm">Propriedades</h4>
                <button onClick={() => setSelectedField(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input value={selectedField.label} onChange={e => updateSelectedField({ label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input value={selectedField.placeholder || ''} onChange={e => updateSelectedField({ placeholder: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Helper Text</Label>
                <Input value={selectedField.helperText || ''} onChange={e => updateSelectedField({ helperText: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" checked={selectedField.required} onChange={e => updateSelectedField({ required: e.target.checked })} />
                <Label>Campo Obrigatório</Label>
              </div>
              {(selectedField.type === 'select' || selectedField.type === 'single_choice' || selectedField.type === 'multi_select') && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Opções (uma por linha)</Label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedField.options?.join('\n') || ''}
                    onChange={e => updateSelectedField({ options: e.target.value.split('\n').map((s:string)=>s.trim()).filter(Boolean) })}
                    placeholder={'Opção 1\nOpção 2\nOpção 3'}
                  />
                </div>
              )}
              {/* Image upload per field */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-xs">Imagem da pergunta</Label>
                <ImageUploadButton
                  orgSlug={orgSlug}
                  value={selectedField.imageUrl}
                  onChange={url => updateSelectedField({ imageUrl: url })}
                  previewHeight="max-h-32"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-1/2 bg-muted flex flex-col relative">
        <div className="p-4 flex justify-between items-center border-b bg-background/50 backdrop-blur-sm z-10 shrink-0">
          <div className="text-sm font-medium text-muted-foreground">Preview</div>
          <Button variant="outline" size="sm" onClick={() => window.open(`/f/${form.slug}/preview`, '_blank')}>Ver em tela cheia ↗</Button>
        </div>
        <div className="flex-1 flex justify-center items-start pt-12 pb-12 overflow-y-auto hide-scrollbar">
          <div className="w-full max-w-sm bg-background border rounded-3xl shadow-2xl overflow-hidden pointer-events-none relative ring-8 ring-muted/50">
             <div className="bg-muted px-4 py-3 flex justify-center items-center border-b gap-1 relative">
                <div className="absolute left-4 w-12 h-4 bg-background/50 rounded-full" />
                <div className="w-1/3 h-1.5 bg-background rounded-full" />
             </div>
             <div className="p-6">
                <h2 className="text-xl font-bold mb-6 text-center">{form.name}</h2>
                {schema.mode === 'one_question'
                  ? <OneQuestionForm schema={schema} isPreview />
                  : <PublicFormPreview schema={schema} />}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
