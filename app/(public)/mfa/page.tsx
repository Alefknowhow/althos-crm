'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { redeemRecoveryCode } from '@/actions/mfa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogoMark } from '@/components/brand/Logo'
import { Loader2, ShieldCheck } from 'lucide-react'

function MfaInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const next = params.get('next') || '/onboarding'

  const [factorId, setFactorId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [recovery, setRecovery] = useState('')

  // Find the verified TOTP factor for this session.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = (data?.totp ?? []).find(f => f.status === 'verified')
      if (!active) return
      if (!totp) {
        // No factor — nothing to challenge; go on.
        router.replace(next)
        return
      }
      setFactorId(totp.id)
      setReady(true)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify() {
    if (!factorId || code.length < 6) return
    setBusy(true)
    setError('')
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr || !ch) {
        setError('Falha ao validar. Tente novamente.')
        return
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      })
      if (vErr) {
        setError('Código incorreto. Verifique o app autenticador.')
        return
      }
      router.replace(next)
    } finally {
      setBusy(false)
    }
  }

  async function submitRecovery() {
    if (recovery.trim().length < 4) return
    setBusy(true)
    setError('')
    try {
      const res = await redeemRecoveryCode(recovery)
      if (!res.ok) {
        setError(res.error)
        return
      }
      // 2FA removed — the aal1 session is now sufficient.
      router.replace(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 mb-1">
            <LogoMark className="h-9 w-9" />
            <span className="text-2xl font-black tracking-tighter text-foreground">Althos CRM</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Verificação em duas etapas</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            {useRecovery
              ? 'Digite um dos seus códigos de recuperação.'
              : 'Digite o código de 6 dígitos do seu app autenticador.'}
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-center">{error}</p>
        )}

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : useRecovery ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recovery">Código de recuperação</Label>
              <Input
                id="recovery"
                placeholder="xxxxx-xxxxx"
                value={recovery}
                onChange={e => setRecovery(e.target.value)}
                className="h-11 font-mono text-center tracking-wider"
              />
            </div>
            <Button className="w-full h-11" onClick={submitRecovery} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Recuperar acesso
            </Button>
            <button
              type="button"
              onClick={() => { setUseRecovery(false); setError('') }}
              className="w-full text-xs text-primary hover:underline"
            >
              Usar o app autenticador
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') verify() }}
                className="h-11 tracking-[0.4em] font-mono text-center text-lg"
                autoFocus
              />
            </div>
            <Button className="w-full h-11" onClick={verify} disabled={busy || code.length < 6}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verificar
            </Button>
            <button
              type="button"
              onClick={() => { setUseRecovery(true); setError('') }}
              className="w-full text-xs text-primary hover:underline"
            >
              Perdi o acesso ao app — usar código de recuperação
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaInner />
    </Suspense>
  )
}
