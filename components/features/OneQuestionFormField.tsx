'use client'

/**
 * Per-question input renderer for OneQuestionForm. Prop-driven, split
 * out of OneQuestionForm.tsx.
 */

import { Input } from '@/components/ui/input'
import type { FormField } from './PublicFormSchema'

export function FieldRenderer({
  field,
  value,
  onChange,
  onAutoAdvance,
  isPreview,
  loading,
  dark = false,
}: {
  field: FormField
  value: any
  onChange: (v: any) => void
  onAutoAdvance: () => void
  isPreview: boolean
  loading: boolean
  dark?: boolean
}) {
  const common = {
    disabled: loading,
    readOnly: isPreview,
    tabIndex: isPreview ? -1 : 0,
    className: 'bg-background text-base',
  }

  if (field.type === 'short_text') {
    return <Input {...common} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} />
  }
  if (field.type === 'long_text') {
    return (
      <textarea
        {...common}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />
    )
  }
  if (field.type === 'email') {
    return <Input {...common} type="email" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || 'voce@email.com'} />
  }
  if (field.type === 'phone') {
    return <Input {...common} type="tel" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '(00) 00000-0000'} />
  }
  if (field.type === 'number') {
    return <Input {...common} type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '0'} />
  }
  if (field.type === 'date') {
    return <Input {...common} type="date" value={value || ''} onChange={e => onChange(e.target.value)} />
  }
  if (field.type === 'select') {
    return (
      <select
        disabled={loading || isPreview}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="" disabled>{field.placeholder || 'Selecione uma opção'}</option>
        {field.options?.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }
  if (field.type === 'single_choice') {
    return (
      <div className="grid gap-2">
        {field.options?.map((opt, i) => {
          const selected = value === opt
          return (
            <button
              type="button"
              key={i}
              disabled={loading || isPreview}
              onClick={() => {
                onChange(opt)
                onAutoAdvance()
              }}
              className={`text-left px-4 py-3 border rounded-lg transition-colors text-base font-medium ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'bg-background hover:border-primary hover:bg-primary/5'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'multi_select') {
    const arr: string[] = Array.isArray(value) ? value : []
    return (
      <div className="grid gap-2">
        {field.options?.map((opt, i) => {
          const selected = arr.includes(opt)
          return (
            <button
              type="button"
              key={i}
              disabled={loading || isPreview}
              onClick={() => {
                if (selected) onChange(arr.filter(v => v !== opt))
                else onChange([...arr, opt])
              }}
              className={`text-left px-4 py-3 border rounded-lg transition-colors text-base font-medium ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'bg-background hover:border-primary hover:bg-primary/5'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'rating') {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={loading || isPreview}
            onClick={() => { onChange(n); onAutoAdvance() }}
            className={`text-3xl transition-colors ${(value || 0) >= n ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }
  if (field.type === 'opinion_scale') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, n) => n).map(n => (
          <button
            key={n}
            type="button"
            disabled={loading || isPreview}
            onClick={() => { onChange(n); onAutoAdvance() }}
            className={`flex items-center justify-center w-9 h-9 rounded-md border text-sm font-medium transition-colors ${
              value === n ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-primary/50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          disabled={loading || isPreview}
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-5 h-5 mt-0.5 rounded border-gray-300 accent-primary"
        />
        <span className={`text-sm ${dark ? 'text-gray-200' : 'text-muted-foreground'}`}>{field.placeholder || 'Confirmo'}</span>
      </label>
    )
  }
  return null
}
