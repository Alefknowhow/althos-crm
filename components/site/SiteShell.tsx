import { SiteNav } from './SiteNav'
import { SiteFooter } from './SiteFooter'

/**
 * Casca padrão das páginas institucionais (marketing).
 * Aplica o tema escuro explicitamente (não depende do theme do PublicLayout,
 * que força light), fixa a nav no topo e adiciona o rodapé.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#161616] antialiased selection:bg-[#4589ff]/20">
      <SiteNav />
      <main className="pt-14">{children}</main>
      <SiteFooter />
    </div>
  )
}
