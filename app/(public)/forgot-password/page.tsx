'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await requestPasswordReset(email)
    setLoading(false)
    if (!res.ok) {
      setError((res as any).error || 'Erro ao enviar e-mail.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[400px] bg-white rounded-none   p-8 space-y-6">

        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <MailCheck className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Verifique seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para <strong>{email}</strong>. Clique nele para criar uma nova senha.
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline mt-2">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-bold tracking-tight">Recuperar senha</h1>
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Exemplo@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground">
              Lembrou a senha?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
