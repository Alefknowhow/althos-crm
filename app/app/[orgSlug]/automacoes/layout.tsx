import AutomationsShell from '@/components/features/automations/AutomationsShell'

/**
 * Nested layout for the automations section.
 * Auth + org lookup is already done by the parent [orgSlug]/layout.tsx.
 * A lista de automações não é mais carregada aqui — virou conteúdo da
 * rota-índice (app/app/[orgSlug]/automacoes/page.tsx).
 */
export default function AutomacoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <AutomationsShell orgSlug={params.orgSlug}>
      {children}
    </AutomationsShell>
  )
}
