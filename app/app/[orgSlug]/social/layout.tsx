import InstagramTabsNav from '@/components/features/social/InstagramTabsNav'
import { getSocialConnections } from '@/actions/social-automations'

/**
 * Casca compartilhada do hub do Instagram: a barra de abas (Direct Inbox ↔
 * Automações) fica sempre na mesma posição/altura/estilo, independente de
 * qual aba está ativa — cada página só entrega o conteúdo abaixo dela.
 */
export default async function SocialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const connections = await getSocialConnections(params.orgSlug)
  const connection = connections[0] ?? null

  return (
    <div className="h-[calc(100vh-4rem)] -mx-6 -mb-6 flex flex-col bg-background overflow-hidden">
      <div className="h-16 px-4 sm:px-6 border-b bg-background flex items-center shrink-0">
        <InstagramTabsNav
          orgSlug={params.orgSlug}
          connected={connections.length > 0}
          username={connection?.username ?? null}
          avatarUrl={connection?.avatar_url ?? null}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
