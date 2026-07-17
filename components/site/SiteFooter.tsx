import Link from 'next/link'
import { SITE_NAV } from '@/lib/site/content'
import { NICHES } from '@/lib/landing/niches'
import { FEATURES } from '@/lib/landing/features'

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
    <footer className="relative z-10 border-t border-[#15171c]/8 bg-[#fafafb]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-7">
          {/* Brand + CTA */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-sm font-black">
                A
              </span>
              <span className="text-base font-semibold tracking-tight text-[#15171c]">
                ALTHOS <span className="text-[#15171c]/40 font-normal">CRM</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-[#15171c]/65">
              O CRM com IA e automações que transforma mais leads em clientes.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
            >
              Começar grátis
            </Link>
          </div>

          {/* Navegação */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15171c]/45">Navegação</p>
            <ul className="mt-3 space-y-1.5">
              {SITE_NAV.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Produto */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15171c]/45">Produto</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/login" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">Entrar</Link></li>
              <li><Link href="/signup" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">Criar conta</Link></li>
              <li><Link href="/planos" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">Planos e preços</Link></li>
              <li><Link href="/blog" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15171c]/45">Recursos</p>
            <ul className="mt-3 space-y-1.5">
              {features.map(f => (
                <li key={f.slug}>
                  <Link href={`/${f.slug}`} className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">
                    {f.nav}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Por nicho */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15171c]/45">Por nicho</p>
            <ul className="mt-3 space-y-1.5">
              {niches.map(n => (
                <li key={n.slug}>
                  <Link href={`/${n.slug}`} className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">
                    {n.nav}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15171c]/45">Contato</p>
            <ul className="mt-3 space-y-1.5">
              <li><a href="mailto:suporte@althoscrm.com.br" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors break-all">suporte@althoscrm.com.br</a></li>
              <li><Link href="/faq" className="inline-block py-0.5 text-[14px] text-[#15171c]/70 hover:text-[#15171c] transition-colors">Central de ajuda</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#15171c]/8 pt-5">
          <p className="text-[12px] text-[#15171c]/45">© {year} Althos CRM.</p>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="text-[12px] text-[#15171c]/55 hover:text-[#15171c] transition-colors">Termos</Link>
            <Link href="/privacidade" className="text-[12px] text-[#15171c]/55 hover:text-[#15171c] transition-colors">Privacidade</Link>
            <Link href="/cookies" className="text-[12px] text-[#15171c]/55 hover:text-[#15171c] transition-colors">Cookies</Link>
            <Link href="/exclusao-de-dados" className="text-[12px] text-[#15171c]/55 hover:text-[#15171c] transition-colors">Exclusão de dados</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
