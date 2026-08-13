'use client'

import { resolveFormBackground } from '@/lib/forms/background-presets'
import { resolveFormFontStack } from '@/lib/forms/font-presets'
import { useGoogleFont } from '@/lib/forms/use-google-font'
import { CalendarClock } from 'lucide-react'
import InlineEditableText from './InlineEditableText'
import EditableFieldCard from './EditableFieldCard'
import type { ActivePageId } from './types'

interface Props {
  schema: any
  setSchema: (s: any) => void
  activePageId: ActivePageId
  fieldIndex: number // posição (1-based) do campo ativo
  onUpdateField: (updates: any) => void
}

const DARK_INLINE_CLASS = 'hover:border-white/30 focus:border-white/50 placeholder:text-white/40'

export default function PreviewPane({ schema, setSchema, activePageId, fieldIndex, onUpdateField }: Props) {
  const activeField = schema.fields.find((f: any) => f.id === activePageId)
  useGoogleFont(schema.style?.fontFamily)

  return (
    <div className="flex-1 min-w-0 flex items-center justify-center overflow-y-auto bg-muted/30 p-8">
      {/* Formato 9:16 (o mesmo enquadramento da página pública real, sem
          "cartão" branco por dentro) — o fundo do formulário preenche o
          quadro inteiro, texto claro por cima, igual ao formulário publicado. */}
      <div
        className="relative w-full max-w-[380px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: resolveFormBackground(schema.style?.backgroundPreset), fontFamily: resolveFormFontStack(schema.style?.fontFamily) }}
      >
        <div key={activePageId} className="flex-1 min-h-0 overflow-y-auto px-7 py-10 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activePageId === 'welcome' && (
            <div className="text-center space-y-3">
              <InlineEditableText
                value={schema.welcome?.title || ''}
                onCommit={title => setSchema({ ...schema, welcome: { ...schema.welcome, title } })}
                placeholder="Título da tela de boas-vindas"
                className="text-xl font-bold text-center text-white"
                inputClassName={DARK_INLINE_CLASS}
              />
              <InlineEditableText
                as="textarea"
                value={schema.welcome?.description || ''}
                onCommit={description => setSchema({ ...schema, welcome: { ...schema.welcome, description } })}
                placeholder="Descrição (opcional)"
                className="text-sm text-white/70 text-center"
                inputClassName={DARK_INLINE_CLASS}
              />
              <div className="pt-2">
                <InlineEditableText
                  value={schema.welcome?.buttonText || ''}
                  onCommit={buttonText => setSchema({ ...schema, welcome: { ...schema.welcome, buttonText } })}
                  placeholder="Começar"
                  className="text-center px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium max-w-[200px] mx-auto"
                  inputClassName="hover:border-black/20 focus:border-black/30 placeholder:text-black/40"
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
                className="text-sm text-center text-white"
                inputClassName={DARK_INLINE_CLASS}
              />
              {schema.booking?.enabled && (
                <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/30 text-xs text-white/80">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {schema.booking.label || 'Consultar horários disponíveis'}
                </div>
              )}
            </div>
          )}

          {activeField && (
            <div className="space-y-3">
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded bg-white/15 text-white text-[10px] font-bold">
                {fieldIndex}
              </span>
              <EditableFieldCard field={activeField} onUpdate={onUpdateField} />
            </div>
          )}

          {!activeField && activePageId !== 'welcome' && activePageId !== 'ending' && (
            <p className="text-sm text-white/60 text-center">Selecione uma página à esquerda.</p>
          )}
        </div>

        {schema.footerInfo?.enabled && schema.footerInfo.text && (
          <p className="text-center text-[10px] text-white/50 px-7 pb-4 whitespace-pre-line border-t border-white/10 pt-3 shrink-0">
            {schema.footerInfo.text}
          </p>
        )}
      </div>
    </div>
  )
}
