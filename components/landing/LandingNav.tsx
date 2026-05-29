'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'

export function LandingNav() {
  const { scrollY } = useScroll()
  const navBg     = useTransform(scrollY, [0, 60], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)'])
  const navBorder = useTransform(scrollY, [0, 60], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.07)'])

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{ backgroundColor: navBg, borderBottom: '1px solid', borderColor: navBorder }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-sm sm:text-base font-semibold tracking-tight text-[#1D1D1F]">Althos CRM</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/pricing" className="hidden sm:inline text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
            Preços
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#1D1D1F] px-3.5 sm:px-4 py-1.5 text-[13px] sm:text-sm font-medium text-white hover:bg-[#3D3D3F] transition-colors whitespace-nowrap"
          >
            Teste grátis
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}
