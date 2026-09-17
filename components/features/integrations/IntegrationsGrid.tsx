'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity, Sparkles, MapPin, FileSignature, Mail, DollarSign, Plus, Clock,
} from 'lucide-react'
import { IgIcon, WhatsAppIcon } from '@/components/features/conversas/ConversasChannelIcons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ConnectWhatsappDialog from './ConnectWhatsappDialog'
import ConnectInstagramDialog from './ConnectInstagramDialog'

export type IntegrationCardData = {
  id: string
  title: string
  category: string
  description: string
  /** Linha curta abaixo da descrição — "Conectado há 3 meses", "2 contas conectadas", etc. */
  meta: string
  connected: boolean
  comingSoon?: boolean
  brand: 'whatsapp' | 'instagram' | 'tiktok' | 'google' | 'asaas' | 'ai' | 'email' | 'sign' | 'health'
  /** Presente quando já conectado — "Abrir módulo" leva direto pro uso do dia a dia. */
  moduleHref?: string
  /** "Gerenciar" — configuração fina (sempre disponível, conectado ou não). */
  manageHref?: string
  /** whatsapp/instagram: botão "Conectar" abre o pop-up em vez de navegar. */
  connectKind?: 'whatsapp' | 'instagram'
}

const BRAND_ICON: Record<IntegrationCardData['brand'], { icon: React.ReactNode; className: string }> = {
  // WhatsApp/Instagram já trazem sua própria cor de marca embutida no
  // ícone (círculo verde / gradiente), então o quadrado ao redor fica neutro.
  whatsapp:  { icon: <WhatsAppIcon className="w-6 h-6" />, className: 'bg-muted' },
  instagram: { icon: <IgIcon className="w-6 h-6" />, className: 'bg-muted' },
  tiktok:    { icon: <span className="text-base font-bold">♪</span>, className: 'bg-foreground text-background' },
  google:    { icon: <MapPin className="w-5 h-5" />, className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  asaas:     { icon: <DollarSign className="w-5 h-5" />, className: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
  ai:        { icon: <Sparkles className="w-5 h-5" />, className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  email:     { icon: <Mail className="w-5 h-5" />, className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  sign:      { icon: <FileSignature className="w-5 h-5" />, className: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
  health:    { icon: <Activity className="w-5 h-5" />, className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
}

export default function IntegrationsGrid({ orgSlug, items }: { orgSlug: string; items: IntegrationCardData[] }) {
  const [connectWhatsappOpen, setConnectWhatsappOpen] = useState(false)
  const [connectInstagramOpen, setConnectInstagramOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(item => (
          <IntegrationCard
            key={item.id}
            item={item}
            onConnect={
              item.connectKind === 'whatsapp' ? () => setConnectWhatsappOpen(true)
              : item.connectKind === 'instagram' ? () => setConnectInstagramOpen(true)
              : undefined
            }
          />
        ))}

        <div className="rounded-xl border border-dashed p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]">
          <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-muted-foreground">
            <Plus className="w-4 h-4" />
          </div>
          <p className="text-sm font-medium">Mais integrações em breve</p>
          <p className="text-xs text-muted-foreground">Novas ferramentas serão adicionadas aqui conforme forem desenvolvidas.</p>
        </div>
      </div>

      <ConnectWhatsappDialog orgSlug={orgSlug} open={connectWhatsappOpen} onOpenChange={setConnectWhatsappOpen} />
      <ConnectInstagramDialog orgSlug={orgSlug} open={connectInstagramOpen} onOpenChange={setConnectInstagramOpen} />
    </div>
  )
}

function IntegrationCard({ item, onConnect }: { item: IntegrationCardData; onConnect?: () => void }) {
  const brandMeta = BRAND_ICON[item.brand]

  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 min-h-[180px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg shrink-0 grid place-items-center ${brandMeta.className}`}>
            {brandMeta.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground truncate">{item.category}</p>
          </div>
        </div>
        {item.comingSoon ? (
          <Badge className="bg-info text-info-foreground shrink-0">Em breve</Badge>
        ) : (
          <Badge className={`shrink-0 ${item.connected ? 'bg-success text-success-foreground' : 'bg-muted-foreground/60 text-white'}`}>
            {item.connected ? 'Conectado' : 'Desconectado'}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{item.description}</p>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Clock className="w-3 h-3 shrink-0" />
        {item.meta}
      </p>

      <div className="flex items-center gap-2">
        {item.comingSoon ? (
          <Button size="sm" disabled className="flex-1">Em breve</Button>
        ) : item.connected ? (
          <>
            {item.moduleHref && (
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link href={item.moduleHref}>Abrir módulo</Link>
              </Button>
            )}
            {item.manageHref && (
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link href={item.manageHref}>Gerenciar</Link>
              </Button>
            )}
          </>
        ) : onConnect ? (
          <Button size="sm" onClick={onConnect} className="flex-1">Conectar</Button>
        ) : item.manageHref ? (
          <Button asChild size="sm" className="flex-1">
            <Link href={item.manageHref}>Conectar</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
