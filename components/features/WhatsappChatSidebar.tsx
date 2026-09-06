'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, Sparkles } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { agentColor, memberInitials, memberShortLabel } from '@/components/features/ConversationDetailPanel'
import { ConversationTicks, WindowBadge, formatInboxTime } from './WhatsappChatWidgets'

export default function WhatsappChatSidebar({
  orgSlug, isMock, seeding, handleSeed,
  query, setQuery, showFilters, setShowFilters, activeFilters,
  filterSeller, setFilterSeller, filterStage, setFilterStage,
  sellerOptions, stageOptions, filteredConversations, conversations,
  selectedConversation, router, aiEnabledGlobally, members, pipelineStages,
  memberById, handleQuickAssign, handleQuickStageChange, now,
}: any) {
  return (
    <div className={`w-full md:w-1/3 md:max-w-[350px] border-r border-[#e9edef] dark:border-[#2a3942] flex-col bg-white dark:bg-[#111b21] ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
      {/* Busca + filtros do inbox */}
      <div className="px-3 pt-3 pb-2 border-b bg-background shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar conversas..."
              className="h-9 pl-8 pr-7 text-sm rounded-full bg-muted/50"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v: boolean) => !v)}
            className={`relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full border hover:bg-muted ${showFilters || activeFilters ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
            title="Filtros"
            aria-label="Filtros"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
          <Link
            href={`/app/${orgSlug}/whatsapp-templates`}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Templates de mensagem do WhatsApp"
            aria-label="Templates de mensagem do WhatsApp"
          >
            <FileText className="w-4 h-4" />
          </Link>
          {isMock && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
              className="text-xs h-9 shrink-0"
              title="Modo de teste — gera conversas fictícias (WhatsApp não conectado)"
            >
              {seeding ? '...' : '🧪'}
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <select
              value={filterSeller}
              onChange={e => setFilterSeller(e.target.value)}
              className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos os vendedores</option>
              <option value="__none">Sem responsável</option>
              {sellerOptions.map(({ id, member }: any) => (
                <option key={id} value={id}>{member?.name || member?.email || 'Membro'}</option>
              ))}
            </select>
            <select
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
              aria-label="Filtrar por estágio"
            >
              <option value="">Todos os estágios</option>
              {stageOptions.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => { setFilterSeller(''); setFilterStage('') }}
                className="col-span-2 text-[11px] text-muted-foreground hover:text-foreground text-left"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((c: any) => (
          <div key={c.id} onClick={() => router.push(`/app/${orgSlug}/conversas?id=${c.id}`)} className={`p-3 border-b border-[#e9edef] dark:border-[#2a3942] cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors flex items-start gap-3 ${selectedConversation?.id === c.id ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : ''}`}>
            {c.contatos?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.contatos.avatar_url} alt="" className="h-9 w-9 rounded-full shrink-0 object-cover" />
            ) : (
              <div className={`h-9 w-9 rounded-full shrink-0 ${agentColor(c.contact_phone || c.id)} text-white text-[11px] font-semibold flex items-center justify-center`}>
                {memberInitials(c.contact_name, c.contact_phone)}
              </div>
            )}
            <div className="overflow-hidden flex-1 min-w-0 space-y-1">
              {/* Linha 1 — nome, etiqueta manual/IA, janela de 24h, data/hora */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</span>
                  {aiEnabledGlobally && c.automation_paused && (
                    <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200" title="Atendimento manual — IA pausada nesta conversa">
                      manual
                    </span>
                  )}
                  <WindowBadge lastInboundAt={c.last_inbound_at} now={now} />
                  {c.ai_handoff_summary && (
                    <Sparkles className="w-3 h-3 text-primary shrink-0" aria-label="Tem resumo da IA" />
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-medium ${c.unread_count > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {formatInboxTime(c.last_message_at)}
                </span>
              </div>

              {/* Linha 2 — última mensagem + status de envio/leitura */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1 min-w-0 flex-1">
                  {c.last_message_direction === 'outbound' && <ConversationTicks status={c.last_message_status} />}
                  <span className="truncate">{c.last_message_preview || c.contact_phone}</span>
                </div>
                {c.unread_count > 0 && <Badge variant="destructive" className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center p-0 text-[10px]">{c.unread_count}</Badge>}
              </div>

              {/* Linha 3 — responsável (esquerda) / etapa (direita), em
                  posições fixas: cada etiqueta sempre ancorada na sua ponta,
                  independente do tamanho do texto. */}
              <div className="flex items-center justify-between gap-2">
                {c.contatos?.id ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={e => e.stopPropagation()}
                        className={`h-5 w-[76px] shrink-0 rounded-pill ${agentColor(c.contatos?.assigned_to ?? null)} text-white text-[9px] font-semibold flex items-center justify-center px-1.5 truncate hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 transition-all`}
                        title={(() => {
                          const m = memberById[c.contatos?.assigned_to]
                          return m ? `Responsável: ${m.name || m.email} — clique para mudar` : 'Sem responsável — clique para atribuir'
                        })()}
                      >
                        <span className="truncate">
                          {c.contatos?.assigned_to
                            ? memberShortLabel(memberById[c.contatos.assigned_to]?.name, memberById[c.contatos.assigned_to]?.email)
                            : 'Sem resp.'}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleQuickAssign(c.contatos.id, null)}>Ninguém</DropdownMenuItem>
                      {members.map((m: any) => (
                        <DropdownMenuItem key={m.user_id} onClick={() => handleQuickAssign(c.contatos.id, m.user_id)}>
                          {m.name || m.email}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <span />}
                {c.contatos?.id ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {(() => {
                        const stageColor = c.contatos?.pipeline_stages?.color || '#8a3ffc'
                        return (
                          <button
                            type="button"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-pill max-w-[110px] transition-colors text-white"
                            style={{ backgroundColor: stageColor }}
                            title={c.contatos?.pipeline_stages?.name ? `Etapa: ${c.contatos.pipeline_stages.name} — clique para mudar` : 'Definir etapa'}
                          >
                            <span className="truncate">{c.contatos?.pipeline_stages?.name || 'Sem etapa'}</span>
                          </button>
                        )
                      })()}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      {pipelineStages
                        .filter((s: any) => !c.contatos?.pipeline_id || s.pipeline_id === c.contatos.pipeline_id)
                        .map((s: any) => (
                          <DropdownMenuItem key={s.id} onClick={() => handleQuickStageChange(c.contatos.id, c.contatos?.stage_id ?? null, s.id)}>
                            {s.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <span />}
              </div>
            </div>
          </div>
        ))}
        {filteredConversations.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {conversations.length === 0
              ? 'Nenhuma conversa encontrada.'
              : 'Nenhuma conversa corresponde à busca ou aos filtros.'}
          </div>
        )}
      </div>
    </div>
  )
}
