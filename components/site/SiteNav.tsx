'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { SITE_NAV } from '@/lib/site/content'

/**
 * Navegação do site institucional multi-página.
 * Dark theme, fixa no topo, com fade de fundo ao rolar e menu mobile.
 * Marca o item ativo conforme a rota atual.
 */
export function SiteNav() {
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const navBg     = useTransform(scrollY, [0, 60], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.82)'])
  const navBorder = useTransform(scrollY, [0, 60], ['rgba(17,20,28,0)', 'rgba(17,20,28,0.08)'])
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{ backgroundColor: navBg, borderBottom: '1px solid', borderColor: navBorder }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-xs font-black">
            A
          </span>
          <span className="text-sm sm:text-base font-semibold tracking-tight text-[#15171c]">
            ALTHOS <span className="text-[#15171c]/40 font-normal">CRM</span>
          </span>
        </Link>

        {/* Center links — desktop */}
        <div className="hidden lg:flex items-center gap-6">
          {SITE_NAV.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[13px] font-medium transition-colors ${
                isActive(l.href) ? 'text-[#15171c]' : 'text-[#15171c]/55 hover:text-[#15171c]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/login" className="hidden sm:inline text-[13px] font-medium text-[#15171c]/65 hover:text-[#15171c] transition-colors">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-3.5 sm:px-4 py-1.5 text-[13px] sm:text-sm font-semibold text-white hover:bg-indigo-500 transition-colors whitespace-nowrap shadow-sm shadow-indigo-600/20"
          >
Começar grátis
          </Link>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen(v => !v)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#15171c]/65 hover:text-[#15171c]"
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
            className="lg:hidden overflow-hidden border-t border-[#15171c]/8 bg-white/95 backdrop-blur-xl"
          >
            <div className="flex flex-col px-5 py-4 gap-1">
              {SITE_NAV.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`py-2 text-[15px] font-medium transition-colors ${
                    isActive(l.href) ? 'text-[#15171c]' : 'text-[#15171c]/70 hover:text-[#15171c]'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className="py-2 text-[15px] font-medium text-[#15171c]/70">
                Entrar
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
