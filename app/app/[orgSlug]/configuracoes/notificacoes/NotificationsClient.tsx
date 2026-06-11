'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Bell, Mail, Send, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import PushNotificationToggle from '@/components/features/PushNotificationToggle'
import { updateNotificationPrefs } from '@/actions/notifications'
import { sendTestEmail, sendTestPush, type EmailDiag, type PushDiag } from '@/actions/diagnostics'
import {
  NOTIFICATION_GROUPS,
  type NotificationPrefs,
} from '@/lib/notifications/categories'

interface Props {
  orgSlug: string
  initialPrefs: NotificationPrefs
  isTravel: boolean
}

export default function NotificationsClient({ orgSlug, initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs)
  const [pending, start] = useTransition()

  // ── Diagnostics ──────────────────────────────────────────────────────────
  const [emailDiag, setEmailDiag] = useState<EmailDiag | null>(null)
  const [pushDiag, setPushDiag] = useState<PushDiag | null>(null)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingPush, setTestingPush] = useState(false)

  async function testEmail() {
    setTestingEmail(true)
    setEmailDiag(null)
    try {
      const res = await sendTestEmail(orgSlug)
      setEmailDiag(res)
      if (res.ok) toast.success(`E-mail de teste enviado para ${res.to}`)
      else toast.error(res.error || 'Falha no envio do e-mail.')
    } finally {
      setTestingEmail(false)
    }
  }

  async function testPush() {
    setTestingPush(true)
    setPushDiag(null)
    try {
      const res = await sendTestPush(orgSlug)
      setPushDiag(res)
      if (res.ok) toast.success(`Notificação enviada (${res.sent} dispositivo(s)).`)
      else toast.error(res.error || 'Falha no envio do push.')
    } finally {
      setTestingPush(false)
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(initialPrefs),
    [prefs, initialPrefs],
  )

  function toggle(key: string, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
  }

  function save() {
    start(async () => {
      const res = await updateNotificationPrefs(orgSlug, prefs)
      if (res.ok) toast.success('Preferências de notificação salvas.')
      else toast.error(res.error || 'Não foi possível salvar.')
    })
  }

  return (
    <div className="space-y-6">
      {/* Channel status — push enable lives in the header, but surface it here */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 pb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Notificações push</CardTitle>
            <CardDescription>
              As notificações aparecem no desktop e no celular. Ative o push neste dispositivo para recebê-las.
            </CardDescription>
          </div>
          <PushNotificationToggle orgSlug={orgSlug} />
        </CardHeader>
      </Card>

      {/* Diagnostics — test both channels end-to-end (sends only to you) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Testar canais</CardTitle>
          <CardDescription>
            Envia uma notificação push e um e-mail de teste para você mesmo. Use para confirmar se a entrega está funcionando.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Push test */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={testPush} disabled={testingPush}>
              {testingPush ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar notificação de teste
            </Button>
            {pushDiag && (
              <div className={`flex items-start gap-1.5 text-sm ${pushDiag.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                {pushDiag.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>
                  {pushDiag.ok
                    ? `Enviado para ${pushDiag.sent} dispositivo(s).`
                    : pushDiag.error}
                  {!pushDiag.ok && pushDiag.subscriptions === 0 ? '' : null}
                </span>
              </div>
            )}
          </div>

          {/* Email test */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={testEmail} disabled={testingEmail}>
              {testingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Enviar e-mail de teste
            </Button>
            {emailDiag && (
              <div className={`flex items-start gap-1.5 text-sm ${emailDiag.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                {emailDiag.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>
                  {emailDiag.ok ? `Enviado para ${emailDiag.to}.` : emailDiag.error}
                </span>
              </div>
            )}
          </div>

          {/* Email config detail (shown after a test) */}
          {emailDiag && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
              <p><span className="text-muted-foreground">Remetente (from):</span> <span className="font-mono">{emailDiag.from}</span></p>
              <p>
                <span className="text-muted-foreground">RESEND_API_KEY:</span>{' '}
                {emailDiag.apiKeySet ? 'configurada' : <span className="text-destructive font-medium">ausente</span>}
              </p>
              {emailDiag.domains && emailDiag.domains.length > 0 ? (
                <div>
                  <span className="text-muted-foreground">Domínios no Resend:</span>
                  <ul className="mt-1 space-y-0.5">
                    {emailDiag.domains.map(d => (
                      <li key={d.name} className="flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${d.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-mono">{d.name}</span>
                        <span className={d.status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}>— {d.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : emailDiag.domains && emailDiag.domains.length === 0 ? (
                <p className="text-amber-600">Nenhum domínio verificado no Resend — e-mails do domínio personalizado não serão entregues.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category toggles */}
      {NOTIFICATION_GROUPS.map(group => (
        <Card key={group.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={prefs[item.key] !== false}
                  onCheckedChange={v => toggle(item.key, v)}
                  aria-label={item.label}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Sticky save */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  )
}
