import Link from 'next/link'
import { SITE_NAV } from '@/lib/site/content'
import { LogoMark } from '@/components/brand/Logo'
import { NICHES } from '@/lib/landing/niches'
import { FEATURES } from '@/lib/landing/features'

const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    href: 'https://instagram.com/althoscrm',
    path: 'M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm10 2c1.66 0 3 1.34 3 3v10c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h10zm-5 3.5A5.5 5.5 0 1 0 17.5 13 5.5 5.5 0 0 0 12 7.5zm0 2A3.5 3.5 0 1 1 8.5 13 3.5 3.5 0 0 1 12 9.5zM17.8 6a1.2 1.2 0 1 0 1.2 1.2A1.2 1.2 0 0 0 17.8 6z',
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61591777010994',
    path: 'M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5h1.65V3.7C15.9 3.6 15 3.5 13.9 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.2V13H9.9v8h3.6z',
  },
  {
    name: 'YouTube',
    href: 'https://youtube.com/althoscrm',
    path: 'M21.6 7.2s-.2-1.5-.85-2.15c-.8-.85-1.7-.85-2.1-.9C15.9 4 12 4 12 4h-.01s-3.9 0-6.65.15c-.4.05-1.3.05-2.1.9C2.6 5.7 2.4 7.2 2.4 7.2S2.2 8.95 2.2 10.7v1.6c0 1.75.2 3.5.2 3.5s.2 1.5.85 2.15c.8.85 1.85.82 2.3.92 1.67.16 7.1.2 7.1.2s3.9-.01 6.65-.16c.4-.05 1.3-.05 2.1-.9.65-.65.85-2.15.85-2.15s.2-1.75.2-3.5v-1.6c0-1.75-.2-3.5-.2-3.5zM9.9 14.6V8.9l5.4 2.85-5.4 2.85z',
  },
] as const

function SocialIcons({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {SOCIAL_LINKS.map(s => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.name}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f4f4f4]/15 text-[#f4f4f4]/70 hover:text-[#f4f4f4] hover:border-[#f4f4f4]/35 transition-colors"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d={s.path} /></svg>
        </a>
      ))}
    </div>
  )
}

/**
 * Rodapé do site institucional. Reaproveita SITE_NAV e adiciona colunas de
 * produto, nichos, recursos e legais. Dark theme.
 *
 * As colunas "Por nicho" e "Recursos" também servem de link interno para as
 * landing pages de nicho/funcionalidade — sem isso, elas não tinham nenhum
 * link a partir do resto do site (só descobríveis por URL direta).
 */
export function SiteFooter() {
  const year = new Date().getFullYear()
  const niches = Object.values(NICHES)
  const features = Object.values(FEATURES)

  return (
    <footer className="relative z-10 border-t border-[#f4f4f4]/8 bg-[#141414]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-7">
          {/* Brand + CTA */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <span className="text-base font-semibold tracking-tight text-[#f4f4f4]">
                ALTHOS <span className="text-[#f4f4f4]/40 font-normal">CRM</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-[#f4f4f4]/65">
              O CRM com IA e automações que transforma mais leads em clientes.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex rounded-lg bg-[#0f62fe] px-4 py-2 text-[13px] font-semibold text-white   shadow-[#0f62fe]/20 hover:bg-[#4589ff] transition-colors"
            >
              Começar grátis
            </Link>
            <SocialIcons className="mt-5" />
          </div>

          {/* Navegação */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#f4f4f4]/45">Navegação</p>
            <ul className="mt-3 space-y-1.5">
              {SITE_NAV.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Produto */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#f4f4f4]/45">Produto</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/login" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">Entrar</Link></li>
              <li><Link href="/signup" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">Criar conta</Link></li>
              <li><Link href="/planos" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">Planos e preços</Link></li>
              <li><Link href="/blog" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#f4f4f4]/45">Recursos</p>
            <ul className="mt-3 space-y-1.5">
              {features.map(f => (
                <li key={f.slug}>
                  <Link href={`/${f.slug}`} className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">
                    {f.nav}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Por nicho */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#f4f4f4]/45">Por nicho</p>
            <ul className="mt-3 space-y-1.5">
              {niches.map(n => (
                <li key={n.slug}>
                  <Link href={`/${n.slug}`} className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">
                    {n.nav}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#f4f4f4]/45">Contato</p>
            <ul className="mt-3 space-y-1.5">
              <li><a href="mailto:suporte@althoscrm.com.br" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors break-all">suporte@althoscrm.com.br</a></li>
              <li><Link href="/faq" className="inline-block py-0.5 text-[14px] text-[#f4f4f4]/70 hover:text-[#f4f4f4] transition-colors">Central de ajuda</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#f4f4f4]/8 pt-5">
          <p className="text-[12px] text-[#f4f4f4]/45">© {year} Althos CRM.</p>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="text-[12px] text-[#f4f4f4]/55 hover:text-[#f4f4f4] transition-colors">Termos</Link>
            <Link href="/privacidade" className="text-[12px] text-[#f4f4f4]/55 hover:text-[#f4f4f4] transition-colors">Privacidade</Link>
            <Link href="/cookies" className="text-[12px] text-[#f4f4f4]/55 hover:text-[#f4f4f4] transition-colors">Cookies</Link>
            <Link href="/exclusao-de-dados" className="text-[12px] text-[#f4f4f4]/55 hover:text-[#f4f4f4] transition-colors">Exclusão de dados</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
