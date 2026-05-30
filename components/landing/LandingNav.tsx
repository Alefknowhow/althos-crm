'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'

const NAV_LINKS = [
  { label: 'Recursos',     href: '#funcionalidades' },
  { label: 'Planos',       href: '#planos' },
  { label: 'Integrações',  href: '#integracoes' },
  { label: 'Depoimentos',  href: '#depoimentos' },
  { label: 'Contato',      href: 'mailto:suporte@althos.io' },
]

export function LandingNav() {
  const { scrollY } = useScroll()
  const navBg     = useTransform(scrollY, [0, 60], ['rgba(10,14,26,0)', 'rgba(10,14,26,0.85)'])
  const navBorder = useTransform(scrollY, [0, 60], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'])
  const [open, setOpen] = useState(false)

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{ backgroundColor: navBg, borderBottom: '1px solid', borderColor: navBorder }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black">
            A
          </span>
          <span className="text-sm sm:text-base font-semibold tracking-tight text-white">
            ALTHOS <span className="text-white/50 font-normal">CRM</span>
          </span>
        </Link>

        {/* Center links — desktop */}
        <div className="hidden lg:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map(l => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[13px] font-medium text-white/60 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden sm:inline text-[13px] font-medium text-white/70 hover:text-white transition-colors">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-3.5 sm:px-4 py-1.5 text-[13px] sm:text-sm font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shadow-lg shadow-blue-600/25"
          >
            Testar grátis<span className="hidden sm:inline"> por 7 dias</span>
          </Link>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen(v => !v)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:text-white"
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
            className="lg:hidden overflow-hidden border-t border-white/8 bg-[#0A0E1A]/95 backdrop-blur-xl"
          >
            <div className="flex flex-col px-5 py-4 gap-1">
              {NAV_LINKS.map(l => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="py-2 text-[15px] font-medium text-white/70 hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className="py-2 text-[15px] font-medium text-white/70">
                Entrar
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
