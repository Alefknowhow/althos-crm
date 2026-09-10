'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createTaskFromCallInsight } from '@/actions/voice'

export function VoiceCallDetailTabs({ orgSlug, call }: { orgSlug: string; call: any }) {
  const [pending, startTransition] = useTransition()
  const insights = call.voice_call_insights?.[0] ?? call.voice_call_insights
  const transcript = call.voice_transcripts?.[0] ?? call.voice_transcripts
  const recording = call.voice_recordings?.[0] ?? call.voice_recordings

  function handleCreateTask(title: string) {
    if (!call.contato_id) return
    startTransition(async () => {
      const res = await createTaskFromCallInsight(orgSlug, call.contato_id, title)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Tarefa criada.')
    })
  }

  return (
    <Tabs defaultValue="resumo">
      <TabsList>
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
        <TabsTrigger value="gravacao">Gravação</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
        <TabsTrigger value="custos">Custos</TabsTrigger>
      </TabsList>

      <TabsContent value="resumo" className="space-y-4 pt-4">
        {insights ? (
          <>
            <p className="text-sm">{insights.summary}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Intenção: </span>{insights.intent}</div>
              <div><span className="text-muted-foreground">Interesse: </span>{insights.interest_level}</div>
              {insights.objections?.[0] && <div><span className="text-muted-foreground">Objeção principal: </span>{insights.objections[0]}</div>}
              {insights.outcome && <div><span className="text-muted-foreground">Resultado: </span>{insights.outcome}</div>}
            </div>
            {insights.next_steps && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Próxima ação</p>
                <p className="text-sm">{insights.next_steps}</p>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => handleCreateTask(insights.next_steps)}>Criar tarefa</Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Resumo ainda não gerado (disponível após a gravação e transcrição).</p>
        )}
      </TabsContent>

      <TabsContent value="transcricao" className="pt-4">
        {transcript?.segments?.length > 0 ? (
          <div className="space-y-3">
            {transcript.segments.map((s: any, i: number) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{s.speaker}</span>
                {s.start_s != null && <span className="text-xs text-muted-foreground ml-2">{Math.floor(s.start_s / 60)}:{String(Math.floor(s.start_s % 60)).padStart(2, '0')}</span>}
                <p className="text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        ) : transcript?.full_text ? (
          <p className="text-sm whitespace-pre-wrap">{transcript.full_text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma transcrição disponível.</p>
        )}
      </TabsContent>

      <TabsContent value="gravacao" className="pt-4">
        {recording?.url ? (
          <audio controls src={recording.url} className="w-full" />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma gravação disponível para esta chamada.</p>
        )}
      </TabsContent>

      <TabsContent value="insights" className="space-y-4 pt-4">
        {insights ? (
          <>
            {insights.call_score != null && (
              <div>
                <p className="text-xs text-muted-foreground">Call Score</p>
                <p className="text-2xl font-semibold">{insights.call_score}/100</p>
              </div>
            )}
            {insights.call_score_breakdown && Object.keys(insights.call_score_breakdown).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(insights.call_score_breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                    <span>{v as number}/10</span>
                  </div>
                ))}
              </div>
            )}
            {insights.suggested_tasks?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Tarefas sugeridas</p>
                {insights.suggested_tasks.map((t: string, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{t}</span>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => handleCreateTask(t)}>Criar tarefa</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {insights.products_mentioned?.map((p: string) => <Badge key={p} variant="outline">{p}</Badge>)}
              {insights.competitors?.map((c: string) => <Badge key={c} variant="outline">Concorrente: {c}</Badge>)}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Insights ainda não gerados.</p>
        )}
      </TabsContent>

      <TabsContent value="custos" className="pt-4">
        <div className="grid grid-cols-2 gap-3 text-sm max-w-sm">
          <span className="text-muted-foreground">Custo provider</span>
          <span className="text-right tabular-nums">{((call.provider_cost_cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          <span className="text-muted-foreground">Custo Althos</span>
          <span className="text-right tabular-nums">{((call.althos_cost_cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      </TabsContent>
    </Tabs>
  )
}
