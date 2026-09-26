'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileSignature } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn, formatCurrency } from '@/lib/utils'
import NewContractDialog from './NewContractDialog'
import ContractTemplatesTab from './ContractTemplatesTab'
import ContractsIntegrationTab from './ContractsIntegrationTab'
import type { DocumentTemplateRow } from '@/actions/document-templates'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:               { label: 'Rascunho',              cls: 'bg-muted text-muted-foreground' },
  ready:               { label: 'Pronto para envio',     cls: 'bg-sky-100 text-sky-700' },
  sent:                { label: 'Enviado',                cls: 'bg-amber-100 text-amber-700' },
  viewed:              { label: 'Visualizado',            cls: 'bg-amber-100 text-amber-700' },
  awaiting_signature:  { label: 'Aguardando assinatura',  cls: 'bg-amber-100 text-amber-700' },
  signed:              { label: 'Assinado',                cls: 'bg-success text-success-foreground' },
  rejected:            { label: 'Recusado',                cls: 'bg-destructive text-destructive-foreground' },
  expired:             { label: 'Expirado',                cls: 'bg-muted text-muted-foreground' },
  cancelled:           { label: 'Cancelado',               cls: 'bg-muted text-muted-foreground' },
}

const ORIGIN_LABEL: Record<string, string> = {
  reserva: 'Reserva', venda: 'Venda', oportunidade: 'Oportunidade', cliente: 'Cliente', projeto: 'Projeto',
}

type ContractRow = {
  id: string
  title: string
  status: string
  related_entity_type: string | null
  value_cents: number | null
  contract_signers?: { id: string; status: string }[]
}

function ContractRows({ orgSlug, contracts, emptyLabel, onNew }: {
  orgSlug: string
  contracts: ContractRow[]
  emptyLabel: string
  onNew?: () => void
}) {
  const router = useRouter()
  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-2">
        <FileSignature className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        {onNew && (
          <Button type="button" size="sm" variant="outline" onClick={onNew}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo contrato
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="rounded-lg border divide-y">
      {contracts.map(c => {
        const status = STATUS_LABEL[c.status] || STATUS_LABEL.draft
        const signersCount = c.contract_signers?.length || 0
        const signedCount = c.contract_signers?.filter(s => s.status === 'signed').length || 0
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push(`/app/${orgSlug}/contratos/${c.id}`)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.related_entity_type ? ORIGIN_LABEL[c.related_entity_type] : 'Sem vínculo'}
                {signersCount > 0 && ` · ${signedCount}/${signersCount} assinaturas`}
              </p>
            </div>
            {c.value_cents != null && (
              <span className="text-sm font-medium tabular-nums shrink-0">{formatCurrency(c.value_cents)}</span>
            )}
            <Badge className={cn('shrink-0 text-[10px]', status.cls)}>{status.label}</Badge>
          </button>
        )
      })}
    </div>
  )
}

export default function ContractsListView({
  orgSlug, initialContracts, templates, hasAutentiqueKey, webhookUrl, recentEvents,
  defaultOriginType = 'venda', prefillOrigin = null,
}: {
  orgSlug: string
  initialContracts: ContractRow[]
  templates: DocumentTemplateRow[]
  hasAutentiqueKey: boolean
  webhookUrl: string
  recentEvents: any[]
  defaultOriginType?: 'reserva' | 'venda'
  prefillOrigin?: { type: string; id: string } | null
}) {
  const router = useRouter()
  const [newOpen, setNewOpen] = useState(!!prefillOrigin)

  const inProgress = initialContracts.filter(c => c.status !== 'signed' && c.status !== 'cancelled')
  const signed = initialContracts.filter(c => c.status === 'signed')
  const contractTemplates = templates.filter(t => (t.category || '').toLowerCase().includes('contrato'))
  const pickerTemplates = contractTemplates.length > 0 ? contractTemplates : templates

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Contratos</h1>
          <p className="text-xs text-muted-foreground">Fonte única de contratos e assinaturas eletrônicas — reutilizável por Reservas, Vendas, Oportunidades e mais.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo contrato
        </Button>
      </div>

      <Tabs defaultValue="gestao">
        <TabsList>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="gestao">Gestão</TabsTrigger>
          <TabsTrigger value="assinados">Assinados</TabsTrigger>
          <TabsTrigger value="integracao">Integração</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="mt-4">
          <ContractTemplatesTab orgSlug={orgSlug} templates={contractTemplates} />
        </TabsContent>

        <TabsContent value="gestao" className="mt-4">
          <ContractRows orgSlug={orgSlug} contracts={inProgress} emptyLabel="Nenhum contrato em andamento. Crie um vinculando a uma venda e envie para assinatura." onNew={() => setNewOpen(true)} />
        </TabsContent>

        <TabsContent value="assinados" className="mt-4">
          <ContractRows orgSlug={orgSlug} contracts={signed} emptyLabel="Nenhum contrato assinado ainda." />
        </TabsContent>

        <TabsContent value="integracao" className="mt-4">
          <ContractsIntegrationTab orgSlug={orgSlug} hasApiKey={hasAutentiqueKey} webhookUrl={webhookUrl} recentEvents={recentEvents} />
        </TabsContent>
      </Tabs>

      <NewContractDialog
        orgSlug={orgSlug}
        templates={pickerTemplates}
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultOriginType={defaultOriginType}
        prefillOrigin={prefillOrigin}
        onCreated={id => router.push(`/app/${orgSlug}/contratos/${id}`)}
      />
    </div>
  )
}
