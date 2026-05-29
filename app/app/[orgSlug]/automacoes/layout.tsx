import { getAutomations } from '@/actions/automations'
import AutomationsShell from '@/components/features/automations/AutomationsShell'

/**
 * Nested layout for the automations section.
 * Auth + org lookup is already done by the parent [orgSlug]/layout.tsx —
 * we only need the automations list for the sidebar.
 */
export default async function AutomacoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  // getAutomations is safe: returns [] on any error, never throws.
  const automations = await getAutomations(params.orgSlug)

  return (
    <AutomationsShell orgSlug={params.orgSlug} automations={automations}>
      {children}
    </AutomationsShell>
  )
}
