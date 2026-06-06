import Link from 'next/link'
import { SITE_NAV } from '@/lib/site/content'

/**
 * Rodapé do site institucional. Reaproveita SITE_NAV e adiciona colunas de
 * produto, recursos e legais. Dark theme.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 border-t border-white/8 bg-[#0A0E1A]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-5">
          {/* Brand + CTA */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-black">
                A
              </span>
              <span className="text-base font-semibold tracking-tight text-white">
                ALTHOS <span className="text-white/50 font-normal">CRM</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-white/70">
              O CRM com IA e automações que transforma mais leads em clientes.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition-colors"
            >
              Começar grátis
            </Link>
          </div>

          {/* Navegação */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/55">Navegação</p>
            <ul className="mt-3 space-y-1.5">
              {SITE_NAV.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Produto */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/55">Produto</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/login" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">Entrar</Link></li>
              <li><Link href="/signup" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">Criar conta</Link></li>
              <li><Link href="/planos" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">Planos e preços</Link></li>
              <li><Link href="/blog" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Contato */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/55">Contato</p>
            <ul className="mt-3 space-y-1.5">
              <li><a href="mailto:suporte@althoscrm.com.br" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors break-all">suporte@althoscrm.com.br</a></li>
              <li><Link href="/faq" className="inline-block py-0.5 text-[14px] text-white/75 hover:text-white transition-colors">Central de ajuda</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/8 pt-5">
          <p className="text-[12px] text-white/55">© {year} Althos CRM.</p>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="text-[12px] text-white/65 hover:text-white transition-colors">Termos</Link>
            <Link href="/privacidade" className="text-[12px] text-white/65 hover:text-white transition-colors">Privacidade</Link>
            <Link href="/cookies" className="text-[12px] text-white/65 hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
