'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { X, Pin } from 'lucide-react'
import { unpinCard, type PinnedCard } from '@/actions/dashboard-layout'

// recharts usa APIs de browser na inicialização — hidrataria quebrado no server.
const AnalyticsViewCard = dynamic(() => import('@/components/features/ai/AnalyticsViewCard'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-lg bg-muted animate-pulse" />,
})

export default function PinnedCardsGrid({
  orgSlug,
  initialCards,
}: {
  orgSlug: string
  initialCards: PinnedCard[]
}) {
  const [cards, setCards] = useState(initialCards)
  const [, startTransition] = useTransition()

  if (cards.length === 0) return null

  function handleUnpin(id: string) {
    setCards(prev => prev.filter(c => c.id !== id))
    startTransition(() => { unpinCard(orgSlug, id) })
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Pin className="w-3.5 h-3.5" />
        Fixados pelo copiloto
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cards.map(card => (
          <div key={card.id} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => handleUnpin(card.id)}
              aria-label="Remover card fixado"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <AnalyticsViewCard view={card.view} label={card.title} />
          </div>
        ))}
      </div>
    </div>
  )
}
