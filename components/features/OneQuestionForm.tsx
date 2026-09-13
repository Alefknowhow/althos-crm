'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import type { FormSchema } from './PublicFormPreview'
import { FieldRenderer } from './OneQuestionFormField'
import { getOrderedFields } from '@/lib/forms/field-order'
import { getNextNodeId } from '@/lib/forms/flow-traversal'

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
  // Reorder: non-contact first, then contact at the end — mesma ordem que
  // o canvas de fluxo usa como fallback (lib/forms/field-order.ts).
  const orderedFields = useMemo(() => getOrderedFields(schema?.fields), [schema])
  const fallbackOrder = useMemo(() => orderedFields.map(f => f.id), [orderedFields])

  const showWelcome = !!schema?.welcome?.enabled
  const totalSteps = orderedFields.length + (showWelcome ? 1 : 0)
  const initialNodeId = showWelcome ? 'welcome' : (fallbackOrder[0] ?? 'ending')
  // Histórico de nodes visitados (não um índice numérico) — com
  // ramificação, "voltar" precisa ir pra pergunta que foi de fato
  // respondida antes, não pra "posição - 1" do array.
  const [history, setHistory] = useState<string[]>([initialNodeId])
  const [values, setValues] = useState<Record<string, any>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const whatsappUrl = buildWhatsAppUrl(schema.whatsapp)
  const whatsappLabel = schema.whatsapp?.label || 'Falar no WhatsApp'

  const currentNodeId = history[history.length - 1]
  const isWelcome = currentNodeId === 'welcome'
  const currentField = orderedFields.find(f => f.id === currentNodeId)
  // Com ramificação, "é a última pergunta?" depende da resposta atual —
  // recalculado a cada render em vez de ser um índice fixo.
  const isLastField = !isWelcome && currentField
    ? getNextNodeId(schema.flow, currentNodeId, values, fallbackOrder) === 'ending'
    : false

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

  const handleAdvance = () => {
    const nextId = getNextNodeId(schema.flow, currentNodeId, values, fallbackOrder)
    if (nextId === 'ending') { handleFinalSubmit(); return }
    setHistory(h => [...h, nextId])
  }

  const handleBack = () => {
    setHistory(h => (h.length > 1 ? h.slice(0, -1) : h))
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
            style={{ width: `${Math.min(100, (history.length / totalSteps) * 100)}%` }}
          />
        </div>
      )}

      <div key={currentNodeId} className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
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
            {/* Per-question media — vídeo tem prioridade sobre imagem. */}
            {currentField.videoUrl ? (
              <div className="rounded-lg overflow-hidden -mx-1">
                <video src={currentField.videoUrl} controls className="w-full max-h-52 rounded-lg" />
              </div>
            ) : currentField.imageUrl ? (
              <div className="rounded-lg overflow-hidden -mx-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentField.imageUrl}
                  alt=""
                  className="w-full object-cover max-h-52 rounded-lg"
                />
              </div>
            ) : null}
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
              {history.length > 1 && (
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
