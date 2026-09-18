'use client'

/**
 * Corpo em abas do painel de detalhe de viagem (Tarefas/Produtos/Viajantes/
 * Vouchers) — extraído de ScheduleTripDetail.tsx só pra não estourar o
 * limite de linhas do arquivo.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  CheckSquare, Loader2, FileIcon, ImageIcon, Users, ListChecks, Package, ExternalLink,
} from 'lucide-react'
import type { ScheduledTrip, TripTask } from '@/actions/travel-schedule'
import type { TripTraveler, TripVoucher } from '@/actions/travel-schedule-detail'
import type { SaleProduct } from '@/actions/sale-products'
import SaleProductCard from '@/components/features/reservas/SaleProductCard'
import { fmtDate } from './ScheduleTripDetail'

export function ScheduleTripDetailTabs({
  orgSlug, trip, tasks, loadingTasks, products, loadingProducts, travelers, vouchers, loadingExtra,
}: {
  orgSlug: string
  trip: ScheduledTrip
  tasks: TripTask[]
  loadingTasks: boolean
  products: SaleProduct[]
  loadingProducts: boolean
  travelers: TripTraveler[]
  vouchers: TripVoucher[]
  loadingExtra: boolean
}) {
  return (
    <Tabs defaultValue="tarefas" className="flex-1 min-h-0 flex flex-col">
      <TabsList className="mx-5 mt-3 w-fit shrink-0">
        <TabsTrigger value="tarefas" className="gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Tarefas
          {tasks.length > 0 && <span className="text-[10px] text-muted-foreground">({tasks.length})</span>}
        </TabsTrigger>
        <TabsTrigger value="produtos" className="gap-1.5">
          <Package className="w-3.5 h-3.5" /> Produtos
          {products.length > 0 && <span className="text-[10px] text-muted-foreground">({products.length})</span>}
        </TabsTrigger>
        <TabsTrigger value="viajantes" className="gap-1.5">
          <Users className="w-3.5 h-3.5" /> Viajantes
        </TabsTrigger>
        <TabsTrigger value="vouchers" className="gap-1.5">
          <FileIcon className="w-3.5 h-3.5" /> Vouchers
          {vouchers.length > 0 && <span className="text-[10px] text-muted-foreground">({vouchers.length})</span>}
        </TabsTrigger>
      </TabsList>

      {/* Tarefas — primeira aba, fica visível por padrão */}
      <TabsContent value="tarefas" className="flex-1 min-h-0 overflow-y-auto px-5 py-4 mt-0">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <CheckSquare className="w-4 h-4 text-primary" /> Tarefas relacionadas
          {loadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        {!trip.contato_id ? (
          <p className="text-sm text-muted-foreground">Viagem sem lead vinculado — sem tarefas.</p>
        ) : !loadingTasks && tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para este cliente.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map(t => {
              const done = t.status === 'done' || t.status === 'completed'
              return (
                <li key={t.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                  <CheckSquare className={cn('w-4 h-4 mt-0.5 shrink-0', done ? 'text-emerald-600' : 'text-muted-foreground')} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate', done && 'line-through text-muted-foreground')}>{t.title || 'Tarefa'}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <Button size="sm" variant="ghost" className="mt-3" asChild>
          <Link href={`/app/${orgSlug}/tarefas`}>Ver todas as tarefas</Link>
        </Button>
      </TabsContent>

      {/* Produtos — todos os itens contratados na reserva, com detalhes completos */}
      <TabsContent value="produtos" className="flex-1 min-h-0 overflow-y-auto px-5 py-4 mt-0">
        {loadingProducts ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando produtos…
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto registrado nesta reserva.</p>
        ) : (
          <div className="space-y-2">
            {products.map(p => <SaleProductCard key={p.id} product={p} readOnly />)}
          </div>
        )}
      </TabsContent>

      {/* Viajantes — titular (cliente da venda) + demais viajantes */}
      <TabsContent value="viajantes" className="flex-1 min-h-0 overflow-y-auto px-5 py-4 mt-0">
        {loadingExtra ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando viajantes…
          </div>
        ) : (
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="font-medium truncate">{trip.client_name || trip.lead_name || '—'}</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">Titular</Badge>
            </li>
            {travelers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="truncate">{t.name || '—'}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {t.birth_date ? fmtDate(t.birth_date) : ''}{t.cpf ? ` · ${t.cpf}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* Vouchers — tudo que foi enviado na reserva, pra acesso rápido */}
      <TabsContent value="vouchers" className="flex-1 min-h-0 overflow-y-auto px-5 py-4 mt-0">
        {loadingExtra ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando vouchers…
          </div>
        ) : vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum voucher enviado nesta reserva.</p>
        ) : (
          <ul className="space-y-1.5">
            {vouchers.map((v, i) => {
              const isPdf = /\.pdf($|\?)/i.test(v.url) || /\.pdf$/i.test(v.name)
              return (
                <li key={`${v.url}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2">
                  {isPdf
                    ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
                    : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                  <a href={v.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-sm text-foreground hover:underline">
                    {v.name || `Voucher ${i + 1}`}
                  </a>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </li>
              )
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
