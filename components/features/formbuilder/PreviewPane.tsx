'use client'

import PublicFormPreview from '../PublicFormPreview'
import { resolveFormBackground } from '@/lib/forms/background-presets'
import { CalendarClock } from 'lucide-react'
import type { ActivePageId } from './types'

interface Props {
  schema: any
  activePageId: ActivePageId
  fieldIndex: number // posição (1-based) do campo ativo, pro badge numerado
}

export default function PreviewPane({ schema, activePageId, fieldIndex }: Props) {
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
              <h2 className="text-xl font-bold">{schema.welcome?.title || 'Título da tela de boas-vindas'}</h2>
              {schema.welcome?.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{schema.welcome.description}</p>
              )}
              <button type="button" className="mt-4 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {schema.welcome?.buttonText || 'Começar'}
              </button>
            </div>
          )}

          {activePageId === 'ending' && (
            <div className="text-center space-y-3">
              <div className="text-3xl">🎉</div>
              <p className="text-sm whitespace-pre-line">
                {schema.thankYouMessage || 'Mensagem de agradecimento exibida após o envio.'}
              </p>
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
              <PublicFormPreview schema={{ fields: [activeField] }} />
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
