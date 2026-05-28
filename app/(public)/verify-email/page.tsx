'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MailCheck, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { resendConfirmationEmail } from '@/actions/auth'

const COOLDOWN_SECONDS = 60

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [status,    setStatus]    = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message,   setMessage]   = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleResend() {
    if (!email || countdown > 0) return
    setStatus('sending')
    setMessage('')
    const result = await resendConfirmationEmail(email)
    if (result.ok) {
      setStatus('sent')
      setMessage('E-mail reenviado! Verifique sua caixa de entrada.')
      setCountdown(COOLDOWN_SECONDS)
    } else {
      setStatus('error')
      setMessage(result.error || 'Erro ao reenviar. Tente novamente.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-2">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um link de confirmação para{' '}
            {email ? <strong>{email}</strong> : 'o seu endereço de e-mail'}.
            Clique nele para ativar sua conta e acessar o CRM.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Não encontrou? Verifique a pasta de <strong>spam</strong> ou lixo eletrônico.
          </p>

          {/* Resend button */}
          {email && (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={status === 'sending' || countdown > 0}
              >
                {status === 'sending' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reenviando...</>
                ) : countdown > 0 ? (
                  `Reenviar em ${countdown}s`
                ) : (
                  'Reenviar e-mail de confirmação'
                )}
              </Button>

              {message && (
                <p className={`text-sm ${status === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                  {message}
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Já confirmou?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Faça login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <CardTitle>Verifique seu e-mail</CardTitle>
            <CardDescription>Carregando...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
