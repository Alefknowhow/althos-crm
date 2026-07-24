'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { SITE_NAV } from '@/lib/site/content'
import { NICHES, NICHE_SLUGS } from '@/lib/landing/niches'
import { LogoMark } from '@/components/brand/Logo'

const NICHE_LINKS = NICHE_SLUGS.map(slug => ({ slug, nav: NICHES[slug].nav }))

/**
 * Navegação do site institucional multi-página.
 * Dark theme (Carbon g100), fixa no topo, com fade de fundo ao rolar e menu mobile.
 * Marca o item ativo conforme a rota atual.
 */
export function SiteNav() {
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const navBg     = useTransform(scrollY, [0, 60], ['rgba(26,26,26,0)', 'rgba(26,26,26,0.85)'])
  const navBorder = useTransform(scrollY, [0, 60], ['rgba(244,244,244,0)', 'rgba(244,244,244,0.1)'])
  const [open, setOpen] = useState(false)
  const [nichesOpen, setNichesOpen] = useState(false)
  const [mobileNichesOpen, setMobileNichesOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50  "
      style={{ backgroundColor: navBg, borderBottom: '1px solid', borderColor: navBorder }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm sm:text-base font-semibold tracking-tight text-[#f4f4f4]">
            ALTHOS <span className="text-[#f4f4f4]/40 font-normal">CRM</span>
          </span>
        </Link>

        {/* Center links — desktop */}
        <div className="hidden lg:flex items-center gap-6">
          <div
            className="relative"
            onMouseEnter={() => setNichesOpen(true)}
            onMouseLeave={() => setNichesOpen(false)}
          >
            <Link
              href="/para-quem-e"
              className={`flex items-center gap-1 text-[13px] font-medium transition-colors ${
                isActive('/para-quem-e') || NICHE_SLUGS.some(s => isActive(`/${s}`)) ? 'text-[#f4f4f4]' : 'text-[#f4f4f4]/55 hover:text-[#f4f4f4]'
              }`}
            >
              Para o seu negócio
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </Link>
            <AnimatePresence>
              {nichesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full pt-2"
                >
                  <div className="w-56 rounded-lg border border-[#f4f4f4]/10 bg-[#1f1f1f] p-1.5 shadow-xl">
                    {NICHE_LINKS.map(n => (
                      <Link
                        key={n.slug}
                        href={`/${n.slug}`}
                        className="block rounded-md px-3 py-2 text-[13px] font-medium text-[#f4f4f4]/75 hover:bg-[#2a2a2a] hover:text-[#f4f4f4] transition-colors"
                      >
                        {n.nav}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {SITE_NAV.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[13px] font-medium transition-colors ${
                isActive(l.href) ? 'text-[#f4f4f4]' : 'text-[#f4f4f4]/55 hover:text-[#f4f4f4]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/login" className="hidden sm:inline text-[13px] font-medium text-[#f4f4f4]/65 hover:text-[#f4f4f4] transition-colors">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#0f62fe] px-3.5 sm:px-4 py-1.5 text-[13px] sm:text-sm font-semibold text-white hover:bg-[#4589ff] transition-colors whitespace-nowrap   shadow-[#0f62fe]/20"
          >
Começar grátis
          </Link>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen(v => !v)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#f4f4f4]/65 hover:text-[#f4f4f4]"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden border-t border-[#f4f4f4]/8 bg-[#1a1a1a]/95  "
          >
            <div className="flex flex-col px-5 py-4 gap-1">
              <button
                type="button"
                onClick={() => setMobileNichesOpen(v => !v)}
                className="flex items-center justify-between py-2 text-[15px] font-medium text-[#f4f4f4]/70"
              >
                Para o seu negócio
                <svg className={`w-3.5 h-3.5 transition-transform ${mobileNichesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {mobileNichesOpen && (
                <div className="flex flex-col gap-1 pb-2 pl-3">
                  {NICHE_LINKS.map(n => (
                    <Link
                      key={n.slug}
                      href={`/${n.slug}`}
                      onClick={() => setOpen(false)}
                      className="py-1.5 text-[14px] text-[#f4f4f4]/60 hover:text-[#f4f4f4]"
                    >
                      {n.nav}
                    </Link>
                  ))}
                </div>
              )}
              {SITE_NAV.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`py-2 text-[15px] font-medium transition-colors ${
                    isActive(l.href) ? 'text-[#f4f4f4]' : 'text-[#f4f4f4]/70 hover:text-[#f4f4f4]'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className="py-2 text-[15px] font-medium text-[#f4f4f4]/70">
                Entrar
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
