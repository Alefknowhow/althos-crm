'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Plus, Check } from 'lucide-react'
import { matchPropertiesForLead, type MatchSuggestion } from '@/actions/property-matching'
import { addInterest } from '@/actions/property-interests'

function scoreColor(score: number) {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
  if (score >= 40) return 'bg-amber-100 text-amber-700 hover:bg-amber-100'
  return 'bg-muted text-muted-foreground hover:bg-muted'
}

export default function PropertyMatchSuggestions({ orgSlug, contatoId }: { orgSlug: string; contatoId: string }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<MatchSuggestion[] | null>(null)
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())

  async function handleRun() {
    setLoading(true)
    const res = await matchPropertiesForLead(orgSlug, contatoId)
    setLoading(false)
    if (!res.ok) { toast.error(res.error); return }
    setSuggestions(res.suggestions)
    if (res.suggestions.length === 0) toast('Nenhum imóvel compatível encontrado.')
  }

  async function handleMarkInterest(propertyId: string) {
    const res = await addInterest(orgSlug, { propertyId, contatoId })
    if (!res.ok) { toast.error(res.error); return }
    setMarkedIds(prev => new Set(prev).add(propertyId))
    toast.success('Interesse marcado')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Sugestões de IA</CardTitle>
        <Button variant="outline" size="sm" onClick={handleRun} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          {loading ? 'Analisando…' : suggestions ? 'Rodar de novo' : 'Sugerir imóveis'}
        </Button>
      </CardHeader>
      {suggestions && suggestions.length > 0 && (
        <CardContent className="space-y-2">
          {suggestions.map(s => (
            <div key={s.propertyId} className="flex items-start justify-between gap-3 border rounded-lg p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/app/${orgSlug}/imoveis/${s.propertyId}`} className="text-sm font-medium hover:underline truncate">
                    {s.title || 'Imóvel'}
                  </Link>
                  {s.code && <span className="text-xs text-muted-foreground">{s.code}</span>}
                  <Badge variant="secondary" className={scoreColor(s.score)}>{s.score}</Badge>
                </div>
                {s.reason && <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>}
              </div>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                disabled={markedIds.has(s.propertyId)}
                onClick={() => handleMarkInterest(s.propertyId)}
              >
                {markedIds.has(s.propertyId) ? <Check className="w-4 h-4 text-emerald-600" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
