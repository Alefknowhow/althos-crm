'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { portalLogin } from '@/actions/client-portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogoMark } from '@/components/brand/Logo'

/**
 * Login do Portal do Cliente — autenticação separada da área interna do
 * Althos (mesma primitiva Supabase Auth, redirect sempre pro portal).
 * Ver actions/client-portal.ts::portalLogin.
 */
export default function PortalLoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await portalLogin(formData)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    router.push(res.redirectTo)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[400px] bg-white rounded-lg p-8 space-y-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-9 w-9" />
          <h1 className="text-xl font-bold tracking-tight">Portal do Cliente</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas campanhas e resultados</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required className="h-11" />
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
