'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MessageCircle, Mail, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import { getStageName, buildWhatsAppUrl, type Lead, type ColKey } from './LeadsViewShared'

/* -------- Leads table -------- */

export default function LeadsTable({
  orgSlug,
  leads,
  selected,
  onToggle,
  onToggleAll,
  isVisible,
}: {
  orgSlug: string
  leads: Lead[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  isVisible: (k: ColKey) => boolean
}) {
  return (
    <div className="bg-card border rounded-none overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selected.size === leads.length}
                  onCheckedChange={onToggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              {isVisible('contact') && <TableHead>Contato</TableHead>}
              {isVisible('score') && <TableHead>Score IA</TableHead>}
              {isVisible('stage') && <TableHead>Estágio</TableHead>}
              {isVisible('tags') && <TableHead>Tags</TableHead>}
              {isVisible('value') && <TableHead>Valor</TableHead>}
              {isVisible('source') && <TableHead>Origem</TableHead>}
              {isVisible('last_activity') && <TableHead>Última atividade</TableHead>}
              {isVisible('created') && <TableHead>Criado em</TableHead>}
              <TableHead className="w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Nenhum lead corresponde aos filtros.
                </TableCell>
              </TableRow>
            ) : (
              leads.map(lead => {
                const wa = buildWhatsAppUrl(lead.phone)
                const stalled =
                  Date.now() - new Date(lead.updated_at).getTime() > 7 * 24 * 60 * 60 * 1000
                return (
                  <TableRow key={lead.id} data-selected={selected.has(lead.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => onToggle(lead.id)}
                        aria-label={`Selecionar ${lead.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/${orgSlug}/contatos/${lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {lead.name}
                      </Link>
                    </TableCell>
                    {isVisible('contact') && (
                      <TableCell>
                        <div className="text-sm">{lead.email || '—'}</div>
                        <div className="text-xs text-muted-foreground">{lead.phone || '—'}</div>
                      </TableCell>
                    )}
                    {isVisible('score') && (
                      <TableCell>
                        {lead.ai_score != null ? (
                          <AIScoreBadge score={lead.ai_score} tier={lead.ai_tier} summary={lead.ai_summary} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVisible('stage') && (
                      <TableCell>
                        <Badge>{getStageName(lead)}</Badge>
                      </TableCell>
                    )}
                    {isVisible('tags') && (
                      <TableCell>
                        <div className="flex items-center gap-1 max-w-[160px] overflow-hidden">
                          {(lead.tags || []).slice(0, 2).map(t => (
                            <span
                              key={t}
                              className="inline-flex items-center shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[72px] truncate"
                              title={t}
                            >
                              {t}
                            </span>
                          ))}
                          {(lead.tags?.length || 0) > 2 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              +{(lead.tags?.length || 0) - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible('value') && (
                      <TableCell className="tabular-nums">
                        {lead.value_cents
                          ? `R$ ${(lead.value_cents / 100).toFixed(2)}`
                          : '—'}
                      </TableCell>
                    )}
                    {isVisible('source') && (
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.source || '—'}
                      </TableCell>
                    )}
                    {isVisible('last_activity') && (
                      <TableCell>
                        <span className={stalled ? 'text-destructive text-xs' : 'text-xs text-muted-foreground'}>
                          {formatDistanceToNow(new Date(lead.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                          {stalled && ' ⚠'}
                        </span>
                      </TableCell>
                    )}
                    {isVisible('created') && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-green-600"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-blue-600"
                            title="E-mail"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-muted-foreground"
                            title="Ligar"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
