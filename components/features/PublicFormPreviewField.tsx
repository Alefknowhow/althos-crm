import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormField } from './PublicFormSchema'

/**
 * Renders the label/helper text/media and the type-specific input control
 * for a single form field. Split out of PublicFormPreview.tsx.
 */
export function PublicFormPreviewField({
  field, isPreview, loading, labelClass, helperClass, hideLabel, hideHelperText, hideMedia,
}: {
  field: FormField
  isPreview: boolean
  loading: boolean
  labelClass: string
  helperClass: string
  hideLabel: boolean
  hideHelperText: boolean
  hideMedia: boolean
}) {
  return (
    <div className="space-y-1.5">
      {/* Per-field media — vídeo tem prioridade sobre imagem. */}
      {!hideMedia && field.videoUrl && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <video src={field.videoUrl} controls className="w-full max-h-52 rounded-lg" />
        </div>
      )}
      {!hideMedia && !field.videoUrl && field.imageUrl && (
        <div className="mb-3 rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={field.imageUrl}
            alt=""
            className="w-full object-cover max-h-52 rounded-lg"
          />
        </div>
      )}

      {!hideLabel && field.type !== 'checkbox' && (
        <Label className={`text-sm font-medium flex items-center gap-1 ${labelClass}`}>
          {field.label} {field.required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {!hideHelperText && field.helperText && field.type !== 'checkbox' && (
        <p className={`text-xs ${helperClass}`}>{field.helperText}</p>
      )}

      {field.type === 'short_text' && (
        <Input
          type="text"
          name={field.id}
          placeholder={field.placeholder || ''}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          className={`bg-background ${isPreview ? 'cursor-default' : ''}`}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'long_text' && (
        <textarea
          name={field.id}
          className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none ${isPreview ? 'cursor-default' : ''}`}
          placeholder={field.placeholder || ''}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'email' && (
        <Input
          type="email"
          name={field.id}
          placeholder={field.placeholder || 'exemplo@email.com'}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          className={`bg-background ${isPreview ? 'cursor-default' : ''}`}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'phone' && (
        <Input
          type="tel"
          name={field.id}
          placeholder={field.placeholder || '(00) 00000-0000'}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          className={`bg-background ${isPreview ? 'cursor-default' : ''}`}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'number' && (
        <Input
          type="number"
          name={field.id}
          placeholder={field.placeholder || '0'}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          className={`bg-background ${isPreview ? 'cursor-default' : ''}`}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'date' && (
        <Input
          type="date"
          name={field.id}
          readOnly={isPreview}
          tabIndex={isPreview ? -1 : 0}
          className={`bg-background ${isPreview ? 'cursor-default' : ''}`}
          disabled={loading}
          required={field.required}
        />
      )}

      {field.type === 'single_choice' && (
        <div className={`grid gap-2 ${isPreview ? 'pointer-events-none' : ''}`}>
          {field.options?.map((opt, i) => (
            <label key={i} className="flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 bg-background">
              <input
                type="radio"
                name={field.id}
                value={opt}
                required={field.required}
                disabled={loading}
                tabIndex={isPreview ? -1 : 0}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'select' && (
        <select
          name={field.id}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isPreview ? 'pointer-events-none' : ''}`}
          tabIndex={isPreview ? -1 : 0}
          defaultValue=""
          disabled={loading}
          required={field.required}
        >
          <option value="" disabled>{field.placeholder || 'Selecione uma opção'}</option>
          {field.options?.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'multi_select' && (
        <div className={`grid gap-2 ${isPreview ? 'pointer-events-none' : ''}`}>
          {field.options?.map((opt, i) => (
            <label key={i} className="flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 bg-background">
              <input
                type="checkbox"
                name={field.id}
                value={opt}
                tabIndex={isPreview ? -1 : 0}
                disabled={loading}
                className="w-4 h-4 rounded accent-primary shrink-0"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'rating' && (
        <div className={`flex items-center gap-1 pt-1 ${isPreview ? 'pointer-events-none' : ''}`}>
          {[1, 2, 3, 4, 5].map(n => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={n}
                tabIndex={isPreview ? -1 : 0}
                disabled={loading}
                required={field.required}
                className="peer sr-only"
              />
              <span className="text-2xl text-muted-foreground/40 peer-checked:text-amber-400 hover:text-amber-300 transition-colors">★</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'opinion_scale' && (
        <div className={`flex flex-wrap gap-1.5 pt-1 ${isPreview ? 'pointer-events-none' : ''}`}>
          {Array.from({ length: 11 }, (_, n) => n).map(n => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={n}
                tabIndex={isPreview ? -1 : 0}
                disabled={loading}
                required={field.required}
                className="peer sr-only"
              />
              <span className="flex items-center justify-center w-8 h-8 rounded-md border text-xs font-medium text-muted-foreground peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary hover:border-primary/50 transition-colors">
                {n}
              </span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className={`flex items-start gap-2 pt-1 ${isPreview ? 'pointer-events-none' : ''}`}>
          <input
            type="checkbox"
            name={field.id}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            tabIndex={isPreview ? -1 : 0}
            disabled={loading}
            required={field.required}
          />
          <div className="space-y-1 leading-none">
            {!hideLabel && (
              <Label className={`text-sm font-medium flex items-center gap-1 ${labelClass}`}>
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
            )}
            {!hideHelperText && field.helperText && (
              <p className={`text-xs ${helperClass}`}>{field.helperText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
