'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'

/** Inline Google "G" logo SVG — no extra dependency needed. */
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

export default function LoginPage() {
  const router = useRouter()
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPass, setShowPass]   = useState(false)
  // True quando o usuário chega após confirmar o e-mail (/login?confirmed=1).
  const [confirmed] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('confirmed') === '1',
  )
  // Optional safe internal redirect (e.g. /login?redirect=/convite/TOKEN).
  // Only same-site, absolute paths are honored to avoid open-redirects.
  const [redirectParam] = useState(() => {
    if (typeof window === 'undefined') return ''
    const r = new URLSearchParams(window.location.search).get('redirect') || ''
    return r.startsWith('/') && !r.startsWith('//') ? r : ''
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (!result.ok) {
      setError(result.error || 'Credenciais inválidas')
      setLoading(false)
    } else if (result.mfaRequired) {
      // Account has 2FA — finish authentication on the challenge screen.
      router.push(`/mfa?next=${encodeURIComponent(redirectParam || result.redirectTo || '/onboarding')}`)
    } else {
      router.push(redirectParam || result.redirectTo!)
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
    <div className="flex min-h-screen">
      {/* Painel de marca — metade esquerda, apenas desktop */}
      <div className="hidden md:flex relative md:w-1/2 lg:w-3/5 shrink-0 items-center justify-center overflow-hidden bg-[#1a1a1a] text-[#f4f4f4] p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-[#4589ff]/20 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-400/15 blur-[120px]" />
        </div>
        <div className="relative max-w-md">
          <div className="flex items-center gap-2.5 mb-10">
            <LogoMark className="h-10 w-10" />
            <span className="text-2xl font-black tracking-tighter">Althos CRM</span>
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight">
            Mais vendas fechadas.<br />
            <span className="bg-gradient-to-r from-[#0f62fe] to-blue-500 bg-clip-text text-transparent">
              Nenhum lead esquecido.
            </span>
          </h1>
          <p className="mt-5 text-[15px] text-[#a8a8a8] leading-relaxed">
            Pipeline, atendimento com IA e automações de vendas num só lugar.
          </p>
        </div>
      </div>

      {/* Caixa de login — metade direita, fora do painel de marca */}
      <div className="flex flex-1 items-center justify-center bg-[#eef2f7] p-4">
        <div className="w-full max-w-[400px] bg-white rounded-none p-8 space-y-6">

          {/* Heading */}
          <div className="flex flex-col items-center gap-1 text-center md:hidden">
            <div className="flex items-center gap-2 mb-1">
              <LogoMark className="h-9 w-9" />
              <span className="text-2xl font-black tracking-tighter text-foreground">Althos CRM</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-xl font-bold tracking-tight">Bem-vindo</h1>
            <p className="text-sm text-muted-foreground leading-snug">
              Acesse seu acelerador de vendas
            </p>
          </div>

        {/* E-mail confirmado com sucesso */}
        {confirmed && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-center">
            E-mail confirmado! Faça login para acessar sua conta.
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Exemplo@gmail.com"
              className="h-11"
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
                placeholder="••••••••"
                className="h-11 pr-10"
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
            {/* Recover password */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Recuperar senha
              </Link>
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {/* Register */}
        <Button
          variant="outline"
          className="w-full h-11"
          asChild
        >
          <Link href="/signup">Registre-se</Link>
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-muted-foreground">ou</span>
          </div>
        </div>

        {/* Google */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-2"
          onClick={handleGoogle}
          disabled={googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
        </Button>

        </div>
      </div>
    </div>
  )
}
