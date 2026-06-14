'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { acceptInviteAsNewUser } from '@/actions/team'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABEL: Record<string, string> = {
  admin:  'Administrador',
  member: 'Membro',
}

/**
 * Lightweight onboarding for an invited member with no account yet.
 * They only choose a name + password — e-mail and função (papel) are fixed by
 * the invitation. On success we sign them in and drop them straight into the
 * workspace.
 */
export default function InviteeSignupForm({
  token,
  email,
  role,
}: {
  token: string
  email: string
  role:  'admin' | 'member'
}) {
  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) { setError('Informe seu nome.'); return }
    if (password.length < 8)    { setError('A senha deve ter pelo menos 8 caracteres.'); return }

    setLoading(true)
    const res = await acceptInviteAsNewUser(token, name, password)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }

    // Account created + invite accepted server-side. Sign in with the fresh
    // credentials, then land in the workspace.
    const supabase = createClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      // Account exists; fall back to the login screen.
      window.location.href = '/login?confirmed=1'
      return
    }
    window.location.href = res.redirectTo
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invitee-email">E-mail</Label>
        <Input id="invitee-email" value={email} readOnly disabled className="h-11 bg-muted/50" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-role">Função</Label>
        <Input id="invitee-role" value={ROLE_LABEL[role] ?? role} readOnly disabled className="h-11 bg-muted/50" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-name">Nome completo</Label>
        <Input
          id="invitee-name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="João Silva"
          className="h-11"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-password">Crie uma senha</Label>
        <div className="relative">
          <Input
            id="invitee-password"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="mínimo 8 caracteres"
            className="h-11 pr-10"
            disabled={loading}
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

      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? 'Criando acesso…' : 'Criar acesso e entrar'}
      </Button>
    </form>
  )
}
