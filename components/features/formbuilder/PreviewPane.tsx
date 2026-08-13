'use client'

import { resolveFormBackground } from '@/lib/forms/background-presets'
import { CalendarClock } from 'lucide-react'
import InlineEditableText from './InlineEditableText'
import EditableFieldCard from './EditableFieldCard'
import type { ActivePageId } from './types'

interface Props {
  schema: any
  setSchema: (s: any) => void
  activePageId: ActivePageId
  fieldIndex: number // posição (1-based) do campo ativo, pro badge numerado
  onUpdateField: (updates: any) => void
}

export default function PreviewPane({ schema, setSchema, activePageId, fieldIndex, onUpdateField }: Props) {
  const activeField = schema.fields.find((f: any) => f.id === activePageId)

  return (
    <div
      className="flex-1 min-w-0 flex items-center justify-center overflow-y-auto p-8"
      style={{ background: resolveFormBackground(schema.style?.backgroundPreset) }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-8 min-h-[420px] flex flex-col justify-center">
          {activePageId === 'welcome' && (
            <div className="text-center space-y-3">
              <InlineEditableText
                value={schema.welcome?.title || ''}
                onCommit={title => setSchema({ ...schema, welcome: { ...schema.welcome, title } })}
                placeholder="Título da tela de boas-vindas"
                className="text-xl font-bold text-center"
              />
              <InlineEditableText
                as="textarea"
                value={schema.welcome?.description || ''}
                onCommit={description => setSchema({ ...schema, welcome: { ...schema.welcome, description } })}
                placeholder="Descrição (opcional)"
                className="text-sm text-muted-foreground text-center"
              />
              <div className="pt-2">
                <InlineEditableText
                  value={schema.welcome?.buttonText || ''}
                  onCommit={buttonText => setSchema({ ...schema, welcome: { ...schema.welcome, buttonText } })}
                  placeholder="Começar"
                  className="text-center px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium max-w-[200px] mx-auto"
                />
              </div>
            </div>
          )}

          {activePageId === 'ending' && (
            <div className="text-center space-y-3">
              <div className="text-3xl">🎉</div>
              <InlineEditableText
                as="textarea"
                value={schema.thankYouMessage || ''}
                onCommit={thankYouMessage => setSchema({ ...schema, thankYouMessage })}
                placeholder="Mensagem de agradecimento"
                className="text-sm text-center"
              />
              {schema.booking?.enabled && (
                <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs text-muted-foreground">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {schema.booking.label || 'Consultar horários disponíveis'}
                </div>
              )}
            </div>
          )}

          {activeField && (
            <div className="relative">
              <span className="absolute -top-2 -left-2 flex items-center justify-center w-5 h-5 rounded bg-foreground text-background text-[10px] font-bold">
                {fieldIndex}
              </span>
              <EditableFieldCard field={activeField} onUpdate={onUpdateField} />
            </div>
          )}

          {!activeField && activePageId !== 'welcome' && activePageId !== 'ending' && (
            <p className="text-sm text-muted-foreground text-center">Selecione uma página à esquerda.</p>
          )}
        </div>

        {schema.footerInfo?.enabled && schema.footerInfo.text && (
          <p className="text-center text-[11px] text-muted-foreground px-8 pb-4 whitespace-pre-line border-t pt-3">
            {schema.footerInfo.text}
          </p>
        )}
      </div>
    </div>
  )
}
