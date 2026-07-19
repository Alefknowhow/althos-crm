import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

type FieldType = 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'select' | 'single_choice' | 'multi_select' | 'date' | 'checkbox'

export interface FormField {
  id: string
  type: FieldType
  label: string
  required?: boolean
  placeholder?: string
  helperText?: string
  options?: string[]
  /** URL of an image to display above the question */
  imageUrl?: string
}

export interface FormWelcome {
  enabled?: boolean
  title?: string
  description?: string
  buttonText?: string
}

export interface FormWhatsApp {
  enabled?: boolean
  phone?: string
  message?: string
  label?: string
}

export interface FormSignature {
  enabled?: boolean
  logoUrl?: string
  name?: string
}

export interface FormStyle {
  backgroundPreset?: 'black' | 'navy' | 'brown' | 'green' | 'red'
}

export interface FormSchema {
  fields: FormField[]
  submitButtonText?: string
  thankYouMessage?: string
  mode?: 'classic' | 'one_question'
  welcome?: FormWelcome
  whatsapp?: FormWhatsApp
  signature?: FormSignature
  style?: FormStyle
}

interface PublicFormPreviewProps {
  schema: FormSchema
  isPreview?: boolean
  onSubmit?: (formData: FormData) => void
  loading?: boolean
  /** true na página pública real (fundo escuro em gradiente) — força
   *  rótulos/textos estáticos em branco/cinza-claro. false (padrão) mantém
   *  as cores normais do CRM, usado no preview do editor de formulários. */
  dark?: boolean
}

export default function PublicFormPreview({ schema, isPreview = true, onSubmit, loading = false, dark = false }: PublicFormPreviewProps) {
  if (!schema?.fields || schema.fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-none bg-muted/30">
        <p className="text-sm font-medium text-foreground">O formulário está vazio</p>
        <p className="text-xs text-muted-foreground mt-1">Adicione campos para ver o preview aqui.</p>
      </div>
    )
  }

  const labelClass = dark ? 'text-white' : 'text-foreground'
  const helperClass = dark ? 'text-gray-300' : 'text-muted-foreground'

  return (
    <form className="space-y-5" onSubmit={e => {
      e.preventDefault();
      if (onSubmit && !isPreview) onSubmit(new FormData(e.currentTarget));
    }}>
      {schema.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          {/* Per-field image */}
          {field.imageUrl && (
            <div className="mb-3 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={field.imageUrl}
                alt=""
                className="w-full object-cover max-h-52 rounded-lg"
              />
            </div>
          )}

          {field.type !== 'checkbox' && (
            <Label className={`text-sm font-medium flex items-center gap-1 ${labelClass}`}>
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
          )}

          {field.helperText && field.type !== 'checkbox' && (
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
                <Label className={`text-sm font-medium flex items-center gap-1 ${labelClass}`}>
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                {field.helperText && (
                  <p className={`text-xs ${helperClass}`}>{field.helperText}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <Button
        type="submit"
        className="w-full mt-6"
        tabIndex={isPreview ? -1 : 0}
        disabled={loading || isPreview}
      >
        {loading ? 'Enviando...' : (schema.submitButtonText || 'Enviar')}
      </Button>

      {/* Footer signature */}
      {schema.signature?.enabled && (schema.signature.logoUrl || schema.signature.name) && (
        <div className={`pt-4 mt-4 border-t flex items-center justify-center gap-2.5 ${dark ? 'border-white/15' : ''}`}>
          {schema.signature.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schema.signature.logoUrl}
              alt={schema.signature.name || 'Logo'}
              className="h-6 w-auto object-contain"
            />
          )}
          {schema.signature.name && (
            <span className={`text-xs font-medium ${helperClass}`}>{schema.signature.name}</span>
          )}
        </div>
      )}
    </form>
  )
}
