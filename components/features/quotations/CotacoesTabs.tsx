'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import ProposalsList from '@/components/features/proposals/ProposalsList'
import BudgetDocumentsView from './BudgetDocumentsView'
import type { BudgetDocumentRow } from '@/actions/budget-documents'

type ProposalRow = Parameters<typeof ProposalsList>[0]['proposals']
type Member = NonNullable<Parameters<typeof ProposalsList>[0]['members']>
type Contato = NonNullable<Parameters<typeof ProposalsList>[0]['contatos']>

export default function CotacoesTabs({
  orgSlug, proposals, members, contatos, budgetDocuments,
}: {
  orgSlug: string
  proposals: ProposalRow
  members: Member
  contatos: Contato
  budgetDocuments: BudgetDocumentRow[]
}) {
  // Some no mobile quando uma proposta está aberta — só faz sentido na tela
  // de lista, igual ao resto da barra de filtros.
  const [proposalOpen, setProposalOpen] = useState(false)

  return (
    <Tabs defaultValue="cotacoes">
      <TabsList className={cn(proposalOpen && 'hidden md:inline-flex')}>
        <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
        <TabsTrigger value="orcamento-ia">Orçamento IA</TabsTrigger>
      </TabsList>
      <TabsContent value="cotacoes">
        <ProposalsList
          orgSlug={orgSlug}
          proposals={proposals}
          members={members}
          contatos={contatos}
          onSelectionChange={setProposalOpen}
        />
      </TabsContent>
      <TabsContent value="orcamento-ia">
        <BudgetDocumentsView orgSlug={orgSlug} documents={budgetDocuments} members={members} />
      </TabsContent>
    </Tabs>
  )
}
