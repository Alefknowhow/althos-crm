'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, ShieldAlert, KeyRound, Copy, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { generateRecoveryCodes, clearRecoveryCodes } from '@/actions/mfa'

interface Props {
  initialEnabled: boolean
  initialRecoveryRemaining: number
}

type Phase = 'idle' | 'enrolling' | 'showCodes'

export default function SecurityClient({ initialEnabled, initialRecoveryRemaining }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [enabled, setEnabled] = useState(initialEnabled)
  const [recoveryRemaining, setRecoveryRemaining] = useState(initialRecoveryRemaining)
  const [phase, setPhase] = useState<Phase>('idle')

  // enrollment state
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[]>([])
  const [pending, start] = useTransition()

  /** Begin TOTP enrollment: clean stale unverified factors, then enroll. */
  async function startEnroll() {
    setBusy(true)
    try {
      // Remove any leftover unverified factors so enroll doesn't collide.
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.totp ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Althos ${Date.now()}`,
      })
      if (error || !data) {
        toast.error(error?.message || 'Não foi possível iniciar a configuração.')
        return
      }
      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setCode('')
      setPhase('enrolling')
    } finally {
      setBusy(false)
    }
  }

  /** Verify the 6-digit code, activate the factor, then generate recovery codes. */
  async function confirmEnroll() {
    if (!factorId || code.trim().length < 6) return
    setBusy(true)
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr || !ch) {
        toast.error(chErr?.message || 'Falha ao validar o código.')
        return
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      })
      if (vErr) {
        toast.error('Código incorreto. Verifique o app autenticador e tente novamente.')
        return
      }

      // Factor is now verified → generate recovery codes.
      const res = await generateRecoveryCodes()
      if (!res.ok) {
        toast.error(res.error)
        // Still enabled — just couldn't make codes.
        setEnabled(true)
        setPhase('idle')
        router.refresh()
        return
      }
      setCodes(res.codes)
      setRecoveryRemaining(res.codes.length)
      setEnabled(true)
      setPhase('showCodes')
      toast.success('Autenticação em duas etapas ativada.')
    } finally {
      setBusy(false)
    }
  }

  function cancelEnroll() {
    if (factorId) supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
    setFactorId(null)
    setQr(null)
    setSecret(null)
    setCode('')
    setPhase('idle')
  }

  /** Regenerate recovery codes for an already-enabled account. */
  function regenerateCodes() {
    start(async () => {
      const res = await generateRecoveryCodes()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setCodes(res.codes)
      setRecoveryRemaining(res.codes.length)
      setPhase('showCodes')
      toast.success('Novos códigos de recuperação gerados.')
    })
  }

  /** Disable 2FA entirely: unenroll every factor + clear recovery codes. */
  function disable2fa() {
    if (!confirm('Desativar a autenticação em duas etapas? Sua conta ficará protegida apenas pela senha.')) return
    start(async () => {
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      await clearRecoveryCodes()
      setEnabled(false)
      setRecoveryRemaining(0)
      setCodes([])
      setPhase('idle')
      toast.success('Autenticação em duas etapas desativada.')
      router.refresh()
    })
  }

  function copyCodes() {
    navigator.clipboard.writeText(codes.join('\n')).then(
      () => toast.success('Códigos copiados.'),
      () => toast.error('Não foi possível copiar.'),
    )
  }

  function downloadCodes() {
    const blob = new Blob(
      [`Códigos de recuperação — Althos CRM\n\n${codes.join('\n')}\n\nGuarde-os em local seguro. Cada código só pode ser usado uma vez.`],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'althos-codigos-recuperacao.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- Recovery codes display (after enabling or regenerating) ----
  if (phase === 'showCodes') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-5 h-5 text-primary" /> Códigos de recuperação
          </CardTitle>
          <CardDescription>
            Guarde estes códigos em local seguro. Se você perder o acesso ao app autenticador,
            um destes códigos permite recuperar o acesso. Cada código funciona apenas uma vez e
            <strong> eles não serão exibidos novamente</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
            {codes.map(c => (
              <span key={c} className="tracking-wider">{c}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyCodes}>
              <Copy className="w-4 h-4 mr-2" /> Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCodes}>
              <Download className="w-4 h-4 mr-2" /> Baixar .txt
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => { setPhase('idle'); router.refresh() }}>
              Já guardei
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- Enrollment (QR + code) ----
  if (phase === 'enrolling') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurar autenticação em duas etapas</CardTitle>
          <CardDescription>
            Escaneie o QR code com um app autenticador (Google Authenticator, Authy, 1Password…)
            e digite o código de 6 dígitos para confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code 2FA" className="h-44 w-44 rounded-lg border bg-white p-2" />
          )}
          {secret && (
            <p className="text-xs text-muted-foreground">
              Não consegue escanear? Insira a chave manualmente:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{secret}</code>
            </p>
          )}
          <div className="space-y-1.5 max-w-[220px]">
            <Label htmlFor="totp-code">Código de 6 dígitos</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="h-11 tracking-[0.3em] font-mono text-center"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmEnroll} disabled={busy || code.length < 6}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ativar 2FA
            </Button>
            <Button variant="ghost" onClick={cancelEnroll} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- Idle: status + main actions ----
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <div
          className={
            'w-10 h-10 rounded-lg flex items-center justify-center ' +
            (enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')
          }
        >
          {enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Autenticação em duas etapas (2FA)</CardTitle>
          <CardDescription>
            {enabled
              ? 'Ativa. Ao entrar, além da senha você precisará do código do app autenticador.'
              : 'Adicione uma camada extra de segurança exigindo um código do app autenticador ao entrar.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <>
            <p className="text-sm text-muted-foreground">
              Códigos de recuperação restantes:{' '}
              <strong className={recoveryRemaining <= 2 ? 'text-amber-600' : ''}>
                {recoveryRemaining}
              </strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={regenerateCodes} disabled={pending}>
                {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Gerar novos códigos de recuperação
              </Button>
              <Button variant="destructive" onClick={disable2fa} disabled={pending}>
                Desativar 2FA
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={startEnroll} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Ativar 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
