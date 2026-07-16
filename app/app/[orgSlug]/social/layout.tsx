import InstagramTabsNav from '@/components/features/social/InstagramTabsNav'

/**
 * Casca compartilhada do hub do Instagram: a barra de abas (DM ↔ Automações)
 * fica sempre na mesma posição/altura/estilo, independente de qual aba está
 * ativa — cada página só entrega o conteúdo abaixo dela.
 */
export default function SocialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col bg-background overflow-hidden">
      <div className="h-16 px-4 sm:px-6 border-b bg-background flex items-center shrink-0">
        <InstagramTabsNav orgSlug={params.orgSlug} />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
