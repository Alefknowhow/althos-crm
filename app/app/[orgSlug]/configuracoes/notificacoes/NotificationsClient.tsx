'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Bell } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import PushNotificationToggle from '@/components/features/PushNotificationToggle'
import { updateNotificationPrefs } from '@/actions/notifications'
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
