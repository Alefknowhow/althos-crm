'use client'

import { X, Plus } from 'lucide-react'
import PublicFormPreview from '../PublicFormPreview'
import InlineEditableText from './InlineEditableText'

const CHOICE_TYPES = ['single_choice', 'select', 'multi_select']

interface Props {
  field: any
  onUpdate: (updates: any) => void
}

/** Renderiza a pergunta ativa no preview central com título/descrição/
 *  opções editáveis diretamente ali (estilo Typeform) — o resto do input
 *  (texto curto, e-mail, data etc) continua vindo do PublicFormPreview
 *  real, só que com o label/helperText próprios escondidos. O fundo do
 *  formulário publicado é sempre escuro (FORM_BACKGROUND_PRESETS), então
 *  o texto aqui é sempre claro pra ficar legível, igual à página real. */
export default function EditableFieldCard({ field, onUpdate }: Props) {
  const isChoice = CHOICE_TYPES.includes(field.type)
  const options: string[] = field.options || []

  function updateOption(idx: number, value: string) {
    const next = [...options]
    next[idx] = value
    onUpdate({ options: next })
  }

  function removeOption(idx: number) {
    onUpdate({ options: options.filter((_, i) => i !== idx) })
  }

  function addOption() {
    onUpdate({ options: [...options, `Opção ${options.length + 1}`] })
  }

  return (
    <div className="space-y-3">
      {field.videoUrl ? (
        <div className="rounded-lg overflow-hidden">
          <video src={field.videoUrl} controls className="w-full max-h-40 rounded-lg" />
        </div>
      ) : field.imageUrl ? (
        <div className="rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={field.imageUrl} alt="" className="w-full object-cover max-h-40 rounded-lg" />
        </div>
      ) : null}

      <div className="flex items-start gap-1">
        <InlineEditableText
          value={field.label}
          onCommit={label => onUpdate({ label })}
          placeholder="Sua pergunta aqui"
          className="text-lg font-semibold text-white"
          inputClassName="hover:border-white/30 focus:border-white/50 placeholder:text-white/40"
        />
        {field.required && <span className="text-white/70 pt-1">*</span>}
      </div>

      <InlineEditableText
        value={field.helperText || ''}
        onCommit={helperText => onUpdate({ helperText })}
        placeholder="Descrição (opcional)"
        className="text-sm text-white/70"
        inputClassName="hover:border-white/30 focus:border-white/50 placeholder:text-white/40"
      />

      {isChoice ? (
        <div className="space-y-1.5 pt-1">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 border border-white/20 rounded-lg group bg-white/5">
              <span className="text-[10px] font-mono text-white/60 border border-white/20 rounded px-1 shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <InlineEditableText
                value={opt}
                onCommit={v => updateOption(i, v)}
                placeholder={`Opção ${i + 1}`}
                className="text-sm flex-1 text-white"
                inputClassName="hover:border-white/30 focus:border-white/50 placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition-opacity shrink-0"
                aria-label="Remover opção"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white hover:underline pt-1"
          >
            <Plus className="w-3 h-3" /> Adicionar opção
          </button>
        </div>
      ) : (
        <div className="pt-1">
          <PublicFormPreview schema={{ fields: [field] }} hideLabel hideHelperText hideMedia dark />
        </div>
      )}
    </div>
  )
}
