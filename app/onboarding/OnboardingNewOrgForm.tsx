'use client'

/**
 * Shared page wrapper + the "new org for existing user" form. Split out
 * of OnboardingForm.tsx.
 */

import { useState } from 'react'
import { createOrganization } from '@/actions/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus } from 'lucide-react'

export function PageWrapper({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[460px]">
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-tighter text-slate-900">Althos CRM</span>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {children}
        <p className="text-center text-xs text-slate-500 mt-6">
          Plano Free para sempre · Sem cartão de crédito
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ORG FORM — only org name (for users who already filled personal data)
// ═══════════════════════════════════════════════════════════════════════════════

export function NewOrgForm() {
  const [orgName,  setOrgName]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit() {
    const name = orgName.trim()
    if (name.length < 2) {
      setError('O nome precisa ter ao menos 2 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.set('name', name)
      const res = await createOrganization(fd)

      if (!res.ok) {
        setError(res.error || 'Erro ao criar organização. Tente um nome diferente.')
        setLoading(false)
        return
      }

      window.location.href = res.redirectTo!
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <PageWrapper subtitle="Crie um novo workspace para sua organização.">
      <div className="bg-white text-slate-900 rounded-2xl shadow-lg p-8 space-y-6">

        {/* Icon + heading */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nova organização</p>
            <h2 className="text-lg font-bold leading-tight">Nome do workspace</h2>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Field */}
        <div className="space-y-1.5">
          <Label htmlFor="org_name">Nome da organização</Label>
          <Input
            id="org_name"
            placeholder="Minha Empresa, João Consultoria…"
            className="h-11"
            value={orgName}
            onChange={e => { setOrgName(e.target.value); setError('') }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
          <p className="text-xs text-slate-500">
            Você pode alterar o nome depois nas configurações.
          </p>
        </div>

        {/* Submit */}
        <Button
          type="button"
          className="w-full h-11 gap-2"
          disabled={loading || !orgName.trim()}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Criando…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Criar workspace
            </>
          )}
        </Button>
      </div>
    </PageWrapper>
  )
}
