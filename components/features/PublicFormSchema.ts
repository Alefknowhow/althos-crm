/**
 * Types for the public form builder/preview schema. Split out of
 * PublicFormPreview.tsx.
 */

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
