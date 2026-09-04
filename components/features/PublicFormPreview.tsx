import React from 'react'
import { Button } from '@/components/ui/button'
import { PublicFormPreviewField } from './PublicFormPreviewField'

export type {
  FieldType, FormField, FormWelcome, FormWhatsApp, FormSignature,
  FormBriefing, FormFooterInfo, FormStyle, FormSchema,
} from './PublicFormSchema'
import type { FormSchema } from './PublicFormSchema'

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
        <PublicFormPreviewField
          key={field.id}
          field={field}
          isPreview={isPreview}
          loading={loading}
          labelClass={labelClass}
          helperClass={helperClass}
          hideLabel={hideLabel}
          hideHelperText={hideHelperText}
          hideMedia={hideMedia}
        />
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
