'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { saveSalesCoachKnowledge } from '@/actions/sales-coach-knowledge'
import type { SalesCoachKnowledge, SalesObjection } from '@/lib/sales-coach/knowledge'

function emptyObjection(): SalesObjection {
  return { id: crypto.randomUUID(), name: '', category: '', description: '', recommendedStrategy: '' }
}

/**
 * Configuração da Knowledge Base + Objection Library do IA Sales Coach
 * (spec §17/§19) — o contexto que as engines (context-engine.ts,
 * event-engine.ts, next-best-action.ts) recebem via `orgKnowledge` quando
 * o consumer da fatia 5 estiver ligado ao stream de transcrição real.
 */
export function SalesCoachKnowledgeForm({ orgSlug, initial }: { orgSlug: string; initial: SalesCoachKnowledge }) {
  const [knowledge, setKnowledge] = useState<SalesCoachKnowledge>(initial)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await saveSalesCoachKnowledge(orgSlug, knowledge)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Contexto do IA Sales Coach salvo.')
    })
  }

  function updateObjection(id: string, patch: Partial<SalesObjection>) {
    setKnowledge((k) => ({
      ...k,
      objections: k.objections.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }))
  }

  function removeObjection(id: string) {
    setKnowledge((k) => ({ ...k, objections: k.objections.filter((o) => o.id !== id) }))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sobre a empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-1.5 block text-xs text-muted-foreground">
            Pitch da empresa
            <Textarea
              rows={3}
              placeholder="Ex.: Somos um CRM multi-tenant para agências e clínicas que unifica WhatsApp, Instagram e pipeline de vendas num só lugar."
              value={knowledge.companyPitch}
              onChange={(e) => setKnowledge((k) => ({ ...k, companyPitch: e.target.value }))}
            />
          </label>
          <label className="space-y-1.5 block text-xs text-muted-foreground">
            Produtos e planos
            <Textarea
              rows={4}
              placeholder="Liste produtos/planos e preços, um por linha. Ex.: Plano Pro — R$299/mês, até 5 usuários, inclui Copiloto IA."
              value={knowledge.products}
              onChange={(e) => setKnowledge((k) => ({ ...k, products: e.target.value }))}
            />
          </label>
          <label className="space-y-1.5 block text-xs text-muted-foreground">
            Diferenciais
            <Textarea
              rows={3}
              placeholder="O que faz sua empresa vencer a concorrência."
              value={knowledge.differentiators}
              onChange={(e) => setKnowledge((k) => ({ ...k, differentiators: e.target.value }))}
            />
          </label>
          <label className="space-y-1.5 block text-xs text-muted-foreground">
            Concorrentes conhecidos
            <Textarea
              rows={2}
              placeholder="Ex.: Kommo, HubSpot, RD Station"
              value={knowledge.competitors}
              onChange={(e) => setKnowledge((k) => ({ ...k, competitors: e.target.value }))}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Objeções conhecidas</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKnowledge((k) => ({ ...k, objections: [...k.objections, emptyObjection()] }))}
          >
            <Plus className="w-4 h-4" /> Adicionar objeção
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {knowledge.objections.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma objeção cadastrada ainda. Ex.: preço, &quot;preciso pensar&quot;, concorrente, implantação.
            </p>
          )}
          {knowledge.objections.map((o) => (
            <div key={o.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome (ex.: Preço)"
                  value={o.name}
                  onChange={(e) => updateObjection(o.id, { name: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Categoria (ex.: preço)"
                  value={o.category}
                  onChange={(e) => updateObjection(o.id, { category: e.target.value })}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeObjection(o.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Descrição — como essa objeção costuma aparecer"
                value={o.description}
                onChange={(e) => updateObjection(o.id, { description: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder="Estratégia recomendada de resposta"
                value={o.recommendedStrategy}
                onChange={(e) => updateObjection(o.id, { recommendedStrategy: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar contexto'}
      </Button>
    </div>
  )
}
