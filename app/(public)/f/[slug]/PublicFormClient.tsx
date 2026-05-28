'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { submitPublicForm } from '@/actions/public_forms'
import { HONEYPOT_FIELD_NAME } from '@/lib/security/antispam-constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageCircle, Calendar } from 'lucide-react'

// Only one of these is ever rendered per submission. Split the bundle so
// Meta Ads landings on mobile load just the active mode's code.
const PublicFormPreview = dynamic(() => import('@/components/features/PublicFormPreview'), {
  ssr: false,
  loading: () => <div className="h-40" />,
})
const OneQuestionForm = dynamic(() => import('@/components/features/OneQuestionForm'), {
  ssr: false,
  loading: () => <div className="h-40" />,
})

function buildWhatsAppUrl(wa: any): string | null {
  if (!wa?.enabled || !wa.phone) return null
  const digits = String(wa.phone).replace(/\D/g, '')
  if (!digits) return null
  const msg = encodeURIComponent(wa.message || '')
  return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`
}

export default function PublicFormClient({
  form,
  utms,
  isPreview = false,
  orgSlug = null,
}: {
  form: any
  utms?: any
  isPreview?: boolean
  orgSlug?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<any>({})
  // Anti-spam: capture mount time once. Honeypot is a hidden input read at submit.
  const mountedAtRef = useRef<number>(Date.now())
  const honeypotRef = useRef<HTMLInputElement | null>(null)

  const schema = form.schema || { fields: [] }
  const mode: 'classic' | 'one_question' = schema.mode || 'classic'
  const showWelcome = !!schema.welcome?.enabled
  const [welcomePassed, setWelcomePassed] = useState(false)

  async function handleSubmit(formData: FormData) {
    if (isPreview) {
      alert('Modo preview: Submissão simulada com sucesso!')
      return
    }

    setLoading(true)
    setError(null)
    setFieldErrors({})

    const rawData: any = {}
    formData.forEach((value, key) => {
      // Handle multi-value (checkbox/multi_select)
      if (rawData[key] !== undefined) {
        rawData[key] = [].concat(rawData[key], value as any)
      } else {
        rawData[key] = value
      }
    })

    const meta = {
      userAgent: window.navigator.userAgent,
      url: window.location.href,
      // Anti-spam payload — read by runAntispamGauntlet on the server.
      honeypot: honeypotRef.current?.value || '',
      formMountedAt: mountedAtRef.current,
      turnstileToken:
        (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)
          ?.value || null,
    }

    const result = await submitPublicForm(form.slug, rawData, utms, meta)

    setLoading(false)

    if (result.ok) {
      // Fire client-side Meta Pixel Lead event (deduplication via leadEventId)
      if (result.metaPixelId) {
        try {
          const fbq = (window as any).fbq
          if (typeof fbq === 'function') {
            fbq('track', 'Lead', {}, { eventID: result.leadEventId || undefined })
          }
        } catch {}
      }
      setSuccess(true)
    } else {
      setError(result.error || 'Erro ao enviar formulário')
      if (result.errors) {
        setFieldErrors(result.errors)
      }
    }
  }

  if (success) {
    // Booking CTA appears here when the form config has it enabled AND we
    // know both the org slug and the target event type slug. Falls back
    // silently otherwise — the operator gets a plain success screen.
    const bookingCfg = schema.booking
    const bookingUrl =
      bookingCfg?.enabled && orgSlug && bookingCfg?.eventTypeSlug && !isPreview
        ? `/book/${orgSlug}/${bookingCfg.eventTypeSlug}`
        : null
    const bookingLabel =
      bookingCfg?.label?.trim() || 'Consultar horários disponíveis para agendamento'

    // WhatsApp CTA (already wired) reuses the same success screen — keep
    // both available so operator can offer two paths.
    const waUrl = buildWhatsAppUrl(schema.whatsapp)

    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold">Sucesso!</h2>
        <p className="text-muted-foreground">
          {schema.thankYouMessage || 'Obrigado! Entraremos em contato em breve.'}
        </p>

        {(bookingUrl || waUrl) && (
          <div className="pt-4 space-y-2 max-w-sm mx-auto">
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full h-11 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors gap-2"
              >
                <Calendar className="w-4 h-4" />
                {bookingLabel}
              </a>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full h-11 px-5 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium transition-colors gap-2"
              >
                <MessageCircle className="w-4 h-4 text-green-600" />
                {schema.whatsapp?.label || 'Falar no WhatsApp'}
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  // Welcome screen for classic mode (one_question handles its own welcome)
  if (mode === 'classic' && showWelcome && !welcomePassed) {
    const whatsappUrl = buildWhatsAppUrl(schema.whatsapp)
    return (
      <div className="space-y-6 text-center py-6">
        {isPreview && <Badge className="mb-2 w-full justify-center bg-orange-100 text-orange-800 hover:bg-orange-100">Modo Preview</Badge>}
        <h2 className="text-2xl font-bold tracking-tight">{schema.welcome?.title || 'Olá!'}</h2>
        {schema.welcome?.description && (
          <p className="text-muted-foreground whitespace-pre-line">{schema.welcome.description}</p>
        )}
        <div className="flex flex-col gap-3 pt-4">
          <Button size="lg" onClick={() => setWelcomePassed(true)}>
            {schema.welcome?.buttonText || 'Começar'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          {whatsappUrl && (
            <a
              href={isPreview ? undefined : whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
              {schema.whatsapp?.label || 'Falar no WhatsApp'}
            </a>
          )}
        </div>
      </div>
    )
  }

  // Hidden honeypot — bots fill all fields by name; humans never see it.
  // Positioned off-screen rather than display:none (bots skip the latter).
  const honeypot = (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
    >
      <label>
        Company email (deixe em branco)
        <input
          ref={honeypotRef}
          type="text"
          name={HONEYPOT_FIELD_NAME}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </label>
    </div>
  )

  if (mode === 'one_question') {
    return (
      <div>
        {honeypot}
        {isPreview && <Badge className="mb-6 w-full justify-center bg-orange-100 text-orange-800 hover:bg-orange-100">Modo Preview (Lead não será criado)</Badge>}
        {error && <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}
        <OneQuestionForm schema={schema} isPreview={isPreview} loading={loading} onSubmit={handleSubmit} />
      </div>
    )
  }

  return (
    <div>
      {honeypot}
      {isPreview && <Badge className="mb-6 w-full justify-center bg-orange-100 text-orange-800 hover:bg-orange-100">Modo Preview (Lead não será criado)</Badge>}
      {error && <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          Por favor, verifique os campos destacados e tente novamente.
        </div>
      )}
      <PublicFormPreview schema={schema} isPreview={false} onSubmit={handleSubmit} loading={loading} />
      {buildWhatsAppUrl(schema.whatsapp) && (
        <div className="pt-6 mt-6 border-t">
          <a
            href={isPreview ? undefined : buildWhatsAppUrl(schema.whatsapp) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-green-600" />
            {schema.whatsapp?.label || 'Prefere falar no WhatsApp?'}
          </a>
        </div>
      )}
    </div>
  )
}
