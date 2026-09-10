import VoiceTabsNav from './VoiceTabsNav'

/** Mesmo padrão de app/app/[orgSlug]/configuracoes/layout.tsx: abas fixas
 *  compartilhadas entre as sub-rotas do módulo, sidebar com só 1 item. */
export default function VoiceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="w-full min-w-0">
      <div id="voice-sticky-header" className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pb-3 bg-background">
        <VoiceTabsNav orgSlug={params.orgSlug} />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  )
}
