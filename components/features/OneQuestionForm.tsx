'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import type { FormField, FormSchema } from './PublicFormPreview'

interface OneQuestionFormProps {
  schema: FormSchema
  isPreview?: boolean
  loading?: boolean
  onSubmit?: (data: FormData) => void
  /** true na página pública real (fundo escuro em gradiente) — força textos
   *  estáticos em branco/cinza-claro. false (padrão) mantém as cores normais
   *  do CRM, usado no preview do editor de formulários. */
  dark?: boolean
}

const CONTACT_TYPES = new Set<FormField['type']>(['email', 'phone'])
function isContactField(f: FormField): boolean {
  if (CONTACT_TYPES.has(f.type)) return true
  if (f.type === 'short_text' && /nome|name/i.test(f.label)) return true
  return false
}

function buildWhatsAppUrl(wa: FormSchema['whatsapp']): string | null {
  if (!wa?.enabled || !wa.phone) return null
  const digits = wa.phone.replace(/\D/g, '')
  if (!digits) return null
  const msg = encodeURIComponent(wa.message || '')
  return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`
}

export default function OneQuestionForm({ schema, isPreview = false, loading = false, onSubmit, dark = false }: OneQuestionFormProps) {
  const textClass = dark ? 'text-white' : ''
  const mutedClass = dark ? 'text-gray-300' : 'text-muted-foreground'
  const dividerClass = dark ? 'border-white/15' : ''
  // Reorder: non-contact first, then contact at the end
  const orderedFields = useMemo(() => {
    if (!schema?.fields) return []
    const nonContact = schema.fields.filter(f => !isContactField(f))
    const contact = schema.fields.filter(f => isContactField(f))
    return [...nonContact, ...contact]
  }, [schema])

  const showWelcome = !!schema?.welcome?.enabled
  const totalSteps = orderedFields.length + (showWelcome ? 1 : 0)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, any>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const whatsappUrl = buildWhatsAppUrl(schema.whatsapp)
  const whatsappLabel = schema.whatsapp?.label || 'Falar no WhatsApp'

  const fieldIndex = showWelcome ? step - 1 : step
  const currentField = orderedFields[fieldIndex]
  const isWelcome = showWelcome && step === 0
  const isLastField = fieldIndex === orderedFields.length - 1

  const handleAdvance = () => {
    if (step < totalSteps - 1) setStep(s => s + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1)
  }

  const handleFinalSubmit = () => {
    if (isPreview) {
      alert('Modo preview: Submissão simulada com sucesso!')
      return
    }
    if (!onSubmit) return
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v))
    })
    onSubmit(fd)
  }

  const setValue = (id: string, v: any) => setValues(prev => ({ ...prev, [id]: v }))

  const currentValue = currentField ? values[currentField.id] : undefined
  const canAdvance = !currentField?.required || (currentValue !== undefined && currentValue !== '')

  if (orderedFields.length === 0 && !showWelcome) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-none bg-muted/30">
        <p className="text-sm font-medium text-foreground">O formulário está vazio</p>
        <p className="text-xs text-muted-foreground mt-1">Adicione campos para ver o preview aqui.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Progress bar */}
      {totalSteps > 1 && (
        <div className={`h-1 rounded-full overflow-hidden mb-8 ${dark ? 'bg-white/15' : 'bg-muted'}`}>
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center">
        {isWelcome && (
          <div className="space-y-6 text-center py-6">
            <h2 className={`text-2xl font-bold tracking-tight ${textClass}`}>
              {schema.welcome?.title || 'Olá!'}
            </h2>
            {schema.welcome?.description && (
              <p className={`whitespace-pre-line ${mutedClass}`}>
                {schema.welcome.description}
              </p>
            )}
            <div className="flex flex-col gap-3 pt-4">
              <Button
                size="lg"
                onClick={handleAdvance}
                disabled={isPreview}
                tabIndex={isPreview ? -1 : 0}
              >
                {schema.welcome?.buttonText || 'Começar'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {whatsappUrl && (
                <a
                  href={isPreview ? undefined : whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium transition-colors"
                  tabIndex={isPreview ? -1 : 0}
                >
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  {whatsappLabel}
                </a>
              )}
            </div>
          </div>
        )}

        {!isWelcome && currentField && (
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault()
              if (isLastField) handleFinalSubmit()
              else handleAdvance()
            }}
            className="space-y-6"
          >
            {/* Per-question image */}
            {currentField.imageUrl && (
              <div className="rounded-lg overflow-hidden -mx-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentField.imageUrl}
                  alt=""
                  className="w-full object-cover max-h-52 rounded-lg"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className={`text-lg font-semibold leading-snug block ${textClass}`}>
                {currentField.label}
                {currentField.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {currentField.helperText && (
                <p className={`text-sm ${mutedClass}`}>{currentField.helperText}</p>
              )}
            </div>

            <FieldRenderer
              field={currentField}
              value={currentValue}
              onChange={(v) => setValue(currentField.id, v)}
              onAutoAdvance={() => {
                if (!isLastField) setTimeout(handleAdvance, 150)
              }}
              isPreview={isPreview}
              loading={loading}
              dark={dark}
            />

            <div className="flex items-center gap-2 pt-4">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={loading}
                  className={dark ? 'text-gray-200 hover:text-white hover:bg-white/10' : ''}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
              )}
              <div className="flex-1" />
              <Button
                type="submit"
                disabled={loading || !canAdvance || isPreview}
              >
                {loading
                  ? 'Enviando...'
                  : isLastField
                  ? schema.submitButtonText || 'Enviar'
                  : 'Continuar'}
                {!loading && !isLastField && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </form>
        )}
      </div>

      {whatsappUrl && !isWelcome && (
        <div className={`pt-8 mt-auto border-t ${dividerClass}`}>
          <a
            href={isPreview ? undefined : whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 text-xs transition-colors ${dark ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
            tabIndex={isPreview ? -1 : 0}
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            Prefere falar no WhatsApp?
          </a>
        </div>
      )}

      {/* Footer signature */}
      {schema.signature?.enabled && (schema.signature.logoUrl || schema.signature.name) && (
        <div className={`pt-4 mt-4 border-t flex items-center justify-center gap-2.5 ${dividerClass}`}>
          {schema.signature.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schema.signature.logoUrl}
              alt={schema.signature.name || 'Logo'}
              className="h-6 w-auto object-contain"
            />
          )}
          {schema.signature.name && (
            <span className={`text-xs font-medium ${mutedClass}`}>{schema.signature.name}</span>
          )}
        </div>
      )}
    </div>
  )
}

function FieldRenderer({
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
