'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, ExternalLink, ImageIcon, Loader2, Store } from 'lucide-react'
import { createOffer, type OfferRow } from '@/actions/quotations'

function brl(cents?: number | null) {
  if (!cents) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function OffersList({
  orgSlug, offers, vitrineToken,
}: { orgSlug: string; offers: OfferRow[]; vitrineToken: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const vitrineUrl = vitrineToken ? `/v/${vitrineToken}` : null

  function handleNew() {
    startTransition(async () => {
      const res = await createOffer(orgSlug)
      if (res.ok) router.push(`/app/${orgSlug}/ofertas/${res.id}`)
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {vitrineUrl && (
          <>
            <Button variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + vitrineUrl); toast.success('Link da vitrine copiado') } catch { toast.error('Não foi possível copiar') }
            }}><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link da vitrine</Button>
            <Button variant="outline" size="sm" asChild>
              <a href={vitrineUrl} target="_blank" rel="noopener noreferrer"><Store className="w-3.5 h-3.5 mr-1.5" /> Ver vitrine</a>
            </Button>
          </>
        )}
        <Button size="sm" className="ml-auto" onClick={handleNew} disabled={pending}>
          {pending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
          Nova oferta
        </Button>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-3 opacity-20" />
          Nenhuma oferta ainda. Crie um pacote pronto — é montado igual a uma cotação, mas sem cliente.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map(o => (
            <Link key={o.id} href={`/app/${orgSlug}/ofertas/${o.id}`}
              className="group rounded-xl border overflow-hidden bg-card hover:shadow-md transition-shadow">
              <div className="aspect-[16/10] bg-muted relative">
                {o.cover_image_url
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.cover_image_url} alt={o.title || ''} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><ImageIcon className="w-8 h-8" /></div>}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge className={o.offer_published ? 'bg-emerald-600' : 'bg-slate-500'}>
                    {o.offer_published ? 'Publicada' : 'Rascunho'}
                  </Badge>
                  {o.offer_category && <Badge variant="secondary">{o.offer_category}</Badge>}
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{o.title || 'Oferta sem título'}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-sm font-bold text-primary">
                    {o.price_per_person_cents ? `${brl(o.price_per_person_cents)}/pessoa` : brl(o.total_cents)}
                  </span>
                  {o.offer_published && o.public_token && (
                    <a href={`/p/${o.public_token}`} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary" title="Abrir link público">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
