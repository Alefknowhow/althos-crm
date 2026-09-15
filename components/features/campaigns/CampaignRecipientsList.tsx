'use client'

/** Pré-lista de destinatários com checkbox — carregada sob demanda em
 *  NewCampaignForm.tsx antes do disparo. Scroll próprio (max-h-72), pra
 *  uma lista grande não estourar o formulário. */

import { Checkbox } from '@/components/ui/checkbox'
import type { AudienceRecipientPreview } from '@/actions/send-campaigns-audience'

export default function CampaignRecipientsList({
  recipients, truncated, excludedIds, channel, onToggle, onToggleAll,
}: {
  recipients: AudienceRecipientPreview[]
  truncated: boolean
  excludedIds: Set<string>
  channel: 'whatsapp' | 'email'
  onToggle: (id: string) => void
  onToggleAll: () => void
}) {
  const includedCount = recipients.length - excludedIds.size

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <Checkbox checked={excludedIds.size === 0} onCheckedChange={onToggleAll} />
          Selecionar todos
        </label>
        <span className="text-xs text-muted-foreground">{includedCount} de {recipients.length} selecionados</span>
      </div>

      {truncated && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-2">
          Mostrando os primeiros {recipients.length} contatos que bateram no filtro.
        </p>
      )}

      {recipients.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum contato nesse filtro.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto border rounded-none divide-y">
          {recipients.map(r => (
            <label key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
              <Checkbox checked={!excludedIds.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name || 'Sem nome'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {channel === 'whatsapp' ? (r.phone || 'Sem telefone') : (r.email || 'Sem e-mail')}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
