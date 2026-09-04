import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export type FieldType = 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'select' | 'single_choice' | 'multi_select' | 'date' | 'checkbox' | 'rating' | 'opinion_scale'

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
  /** URL of a video to display above the question (takes priority over imageUrl) */
  videoUrl?: string
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
  /** Onde a logo/assinatura aparece na página — 'footer' (default) ou 'top'. */
  position?: 'top' | 'footer'
}

/** Briefing: texto curto acima das perguntas, na própria página (modo clássico). */
export interface FormBriefing {
  enabled?: boolean
  text?: string
}

/** Dados institucionais no rodapé (CNPJ, endereço etc) — texto livre. */
export interface FormFooterInfo {
  enabled?: boolean
  text?: string
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
  briefing?: FormBriefing
  footerInfo?: FormFooterInfo
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
  /** Usado só pelo editor (edição inline no preview central): omite o
   *  label/helperText embutidos porque o builder já renderiza sua própria
   *  versão editável por cima. Nunca usado na página pública real. */
  hideLabel?: boolean
  hideHelperText?: boolean
  /** Idem — o builder já renderiza seu próprio bloco de vídeo/imagem no topo
   *  do card quando edita uma pergunta. */
  hideMedia?: boolean
}

export default function PublicFormPreview({ schema, isPreview = true, onSubmit, loading = false, dark = false, hideLabel = false, hideHelperText = false, hideMedia = false }: PublicFormPreviewProps) {
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

  const signaturePosition = schema.signature?.position || 'footer'
  const showTopSignature = schema.signature?.enabled && signaturePosition === 'top' && (schema.signature.logoUrl || schema.signature.name)
  const showFooterSignature = schema.signature?.enabled && signaturePosition === 'footer' && (schema.signature.logoUrl || schema.signature.name)

  return (
    <form className="space-y-5" onSubmit={e => {
      e.preventDefault();
      if (onSubmit && !isPreview) onSubmit(new FormData(e.currentTarget));
    }}>
      {showTopSignature && (
        <div className="flex items-center justify-center gap-2.5 pb-2">
          {schema.signature!.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schema.signature!.logoUrl}
              alt={schema.signature!.name || 'Logo'}
              className="h-10 w-auto object-contain"
            />
          )}
          {schema.signature!.name && (
            <span className={`text-sm font-medium ${labelClass}`}>{schema.signature!.name}</span>
          )}
        </div>
      )}

      {schema.briefing?.enabled && schema.briefing.text && (
        <p className={`text-sm whitespace-pre-line ${helperClass}`}>{schema.briefing.text}</p>
      )}

      {schema.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
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
      {showFooterSignature && (
        <div className={`pt-4 mt-4 border-t flex items-center justify-center gap-2.5 ${dark ? 'border-white/15' : ''}`}>
          {schema.signature!.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schema.signature!.logoUrl}
              alt={schema.signature!.name || 'Logo'}
              className="h-6 w-auto object-contain"
            />
          )}
          {schema.signature!.name && (
            <span className={`text-xs font-medium ${helperClass}`}>{schema.signature!.name}</span>
          )}
        </div>
      )}

      {/* Dados institucionais (CNPJ, endereço etc) */}
      {schema.footerInfo?.enabled && schema.footerInfo.text && (
        <p className={`text-center text-[11px] whitespace-pre-line ${helperClass} ${showFooterSignature ? 'mt-1' : 'pt-4 mt-4 border-t'} ${dark && !showFooterSignature ? 'border-white/15' : ''}`}>
          {schema.footerInfo.text}
        </p>
      )}
    </form>
  )
}
