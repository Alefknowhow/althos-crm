import { SiteNav } from './SiteNav'
import { SiteFooter } from './SiteFooter'
import { CookieConsentBanner } from './CookieConsentBanner'

/**
 * Casca padrão das páginas institucionais (marketing).
 * Sempre dark (mesma paleta Carbon g100 do app) — não depende do theme do
 * PublicLayout, que força light pras telas de auth (login/signup/etc).
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#f4f4f4] antialiased selection:bg-[#4589ff]/30">
      <SiteNav />
      <main className="pt-14">{children}</main>
      <SiteFooter />
      <CookieConsentBanner />
    </div>
  )
}
