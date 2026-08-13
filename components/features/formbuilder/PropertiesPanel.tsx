'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ImageUploadButton from '../ImageUploadButton'
import FieldTypePicker from './FieldTypePicker'
import { getFieldTypeDef } from './FieldTypeMeta'
import type { ActivePageId } from './types'

interface Props {
  orgSlug: string
  activePageId: ActivePageId
  schema: any
  setSchema: (s: any) => void
  selectedField: any | null
  rawOptions: string
  setRawOptions: (v: string) => void
  onCommitOptions: () => void
  onUpdateField: (updates: any) => void
  eventTypes: any[]
}

export default function PropertiesPanel({
  orgSlug, activePageId, schema, setSchema, selectedField,
  rawOptions, setRawOptions, onCommitOptions, onUpdateField, eventTypes,
}: Props) {
  if (activePageId === 'welcome') {
    return (
      <div className="w-80 shrink-0 border-l bg-background overflow-y-auto p-4 space-y-4">
        <h4 className="font-semibold text-sm">Tela de Boas-Vindas</h4>
        <div className="space-y-2">
          <Label className="text-xs">Título</Label>
          <Input
            value={schema.welcome?.title || ''}
            onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, title: e.target.value } })}
            placeholder="Ex: Vamos te conhecer melhor"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Descrição</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={schema.welcome?.description || ''}
            onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, description: e.target.value } })}
            placeholder="Explique brevemente o objetivo do formulário..."
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Texto do botão</Label>
          <Input
            value={schema.welcome?.buttonText || ''}
            onChange={e => setSchema({ ...schema, welcome: { ...schema.welcome, buttonText: e.target.value } })}
            placeholder="Começar"
          />
        </div>
        <button
          type="button"
          onClick={() => setSchema({ ...schema, welcome: { ...schema.welcome, enabled: false } })}
          className="text-xs text-destructive hover:underline pt-2"
        >
          Remover tela de boas-vindas
        </button>
      </div>
    )
  }

  if (activePageId === 'ending') {
    return (
      <div className="w-80 shrink-0 border-l bg-background overflow-y-auto p-4 space-y-4">
        <h4 className="font-semibold text-sm">Agradecimento</h4>
        <div className="space-y-2">
          <Label className="text-xs">Mensagem de sucesso</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={schema.thankYouMessage || ''}
            onChange={e => setSchema({ ...schema, thankYouMessage: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-sm font-medium">Botão de Agendamento</p>
            <p className="text-[11px] text-muted-foreground">Aparece na tela de sucesso.</p>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
            checked={!!schema.booking?.enabled}
            onChange={e => setSchema({ ...schema, booking: { ...(schema.booking || {}), enabled: e.target.checked } })}
          />
        </div>
        {schema.booking?.enabled && (
          <div className="space-y-3">
            {eventTypes.length === 0 ? (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                Nenhum tipo de evento ativo encontrado em Agendamentos.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de evento</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                    value={schema.booking?.eventTypeSlug || ''}
                    onChange={e => setSchema({ ...schema, booking: { ...schema.booking, eventTypeSlug: e.target.value } })}
                  >
                    <option value="">Selecione o tipo de evento</option>
                    {eventTypes.map((et: any) => (
                      <option key={et.slug} value={et.slug}>{et.name} ({et.duration_minutes} min)</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto do botão</Label>
                  <Input
                    value={schema.booking?.label || ''}
                    onChange={e => setSchema({ ...schema, booking: { ...schema.booking, label: e.target.value } })}
                    placeholder="Consultar horários disponíveis"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (selectedField) {
    const def = getFieldTypeDef(selectedField.type)
    const Icon = def.icon
    const showOptions = ['select', 'single_choice', 'multi_select'].includes(selectedField.type)

    return (
      <div className="w-80 shrink-0 border-l bg-background overflow-y-auto p-4 space-y-4">
        <h4 className="font-semibold text-sm">Pergunta</h4>

        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <FieldTypePicker
            onSelect={type => onUpdateField({ type })}
            trigger={
              <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md border border-input text-sm hover:bg-muted transition-colors">
                <span className={`flex items-center justify-center w-6 h-6 rounded ${def.colorClass} shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {def.label}
              </button>
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Label *</Label>
          <Input value={selectedField.label} onChange={e => onUpdateField({ label: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Placeholder</Label>
          <Input value={selectedField.placeholder || ''} onChange={e => onUpdateField({ placeholder: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Descrição (helper text)</Label>
          <Input value={selectedField.helperText || ''} onChange={e => onUpdateField({ helperText: e.target.value })} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
            checked={!!selectedField.required}
            onChange={e => onUpdateField({ required: e.target.checked })}
          />
          <Label className="text-xs">Obrigatória</Label>
        </div>

        {showOptions && (
          <div className="space-y-2 pt-3 border-t">
            <Label className="text-xs">Opções (uma por linha)</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              value={rawOptions}
              onChange={e => setRawOptions(e.target.value)}
              onBlur={onCommitOptions}
              placeholder={'Opção 1\nOpção 2\nOpção 3'}
            />
          </div>
        )}

        <div className="space-y-2 pt-3 border-t">
          <Label className="text-xs">Imagem da pergunta</Label>
          <ImageUploadButton
            orgSlug={orgSlug}
            value={selectedField.imageUrl}
            onChange={url => onUpdateField({ imageUrl: url })}
            previewHeight="max-h-32"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 shrink-0 border-l bg-background overflow-y-auto p-4">
      <p className="text-sm text-muted-foreground">Selecione uma página à esquerda pra editar.</p>
    </div>
  )
}
