'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signup } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

/** Inline Google "G" logo SVG */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  )
}

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const inviteToken  = searchParams.get('invite') || ''
  const refCode      = searchParams.get('ref') || ''

  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPass,      setShowPass]      = useState(false)

  // Bridge the referral code into a short-lived cookie so the org-creation
  // server action can redeem it even through the Google OAuth flow (where the
  // ?ref= param can't survive the provider round-trip).
  useEffect(() => {
    if (refCode) {
      document.cookie = `althos_ref=${encodeURIComponent(refCode)}; max-age=1800; path=/; samesite=lax`
    }
  }, [refCode])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    if (inviteToken) formData.set('inviteToken', inviteToken)
    if (refCode)     formData.set('refCode', refCode)

    const result = await signup(formData)

    if (!result.ok) {
      setError(result.error || 'Erro ao criar conta')
      setLoading(false)
    } else {
      const dest = result.redirectTo!
      const to = dest.startsWith('/verify-email')
        ? `${dest}?email=${encodeURIComponent(formData.get('email') as string)}`
        : dest
      router.push(to)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          ...(inviteToken ? { invite: inviteToken } : {}),
          ...(refCode ? { ref: refCode } : {}),
        },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
      return
    }
    if (data?.url) window.location.href = data.url
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-lg p-8 space-y-6">

        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-black tracking-tighter text-foreground">Althos CRM</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight mt-1">
            {inviteToken ? 'Aceitar convite' : 'Criar conta'}
          </h1>
          <p className="text-sm text-muted-foreground leading-snug">
            {inviteToken
              ? 'Você foi convidado. Crie sua conta para começar.'
              : 'Comece de graça no plano Free · sem cartão.'}
          </p>
        </div>

        {/* Google signup */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-2"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-muted-foreground">ou cadastre com e-mail</span>
          </div>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="João Silva"
              className="h-11"
              disabled={loading || googleLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="joao@exemplo.com"
              className="h-11"
              disabled={loading || googleLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="mínimo 8 caracteres"
                className="h-11 pr-10"
                disabled={loading || googleLoading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11"
            disabled={loading || googleLoading}
          >
            {loading ? 'Criando conta...' : 'Criar conta gratuita'}
          </Button>
        </form>

        {/* Login link */}
        <p className="text-sm text-center text-muted-foreground">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Fazer login
          </Link>
        </p>

      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
        <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-2xl font-black tracking-tighter">Althos CRM</span>
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
