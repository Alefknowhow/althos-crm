'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight } from 'lucide-react'
import { FEATURES } from '@/lib/site/content'
import { SiteIcon } from './SiteIcon'

/**
 * Explorador de funcionalidades estilo Bolten: lista clicável à esquerda,
 * corpo da funcionalidade selecionada à direita (empilha no mobile).
 */
export function FeaturesExplorer() {
  const [active, setActive] = useState(FEATURES[0].slug)
  const feature = FEATURES.find(f => f.slug === active) ?? FEATURES[0]

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Menu clicável */}
      <div className="flex flex-col gap-1.5">
        {FEATURES.map(f => {
          const on = f.slug === active
          return (
            <button
              key={f.slug}
              onClick={() => setActive(f.slug)}
              className={`group flex items-start gap-3 rounded-none border px-4 py-3.5 text-left transition-all ${
                on
                  ? 'border-[#78a9ff] bg-[#0f62fe]/10'
                  : 'border-[#383838] bg-[#262626]   hover:border-[#525252] hover:bg-[#1f1f1f]'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  on ? 'bg-blue-600 text-white' : 'bg-[#333333] text-[#8d8d8d]'
                }`}
              >
                <SiteIcon name={f.icon} className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-semibold ${on ? 'text-[#f4f4f4]' : 'text-[#d4d4d4]'}`}>
                  {f.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[#8d8d8d]">{f.tagline}</span>
              </span>
              <ChevronRight
                className={`mt-1 h-4 w-4 shrink-0 transition-transform ${
                  on ? 'text-[#4589ff] translate-x-0' : 'text-[#525252] group-hover:translate-x-0.5'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Corpo */}
      <div className="relative min-h-0 rounded-none border border-[#383838] bg-[#262626] p-5   sm:min-h-[360px] sm:p-9">
        <AnimatePresence mode="wait">
          <motion.div
            key={feature.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-none bg-blue-600 text-white   shadow-blue-600/30 sm:h-12 sm:w-12">
              <SiteIcon name={feature.icon} className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <h3 className="mt-4 text-xl font-bold text-[#f4f4f4] sm:mt-5 sm:text-2xl">{feature.title}</h3>
            <div className="mt-3 space-y-2.5 sm:space-y-3">
              {feature.body.map((p, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-[#a8a8a8]">{p}</p>
              ))}
            </div>
            <ul className="mt-6 space-y-2.5">
              {feature.bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-[13px] text-[#d4d4d4]">{b}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-7 inline-flex rounded-none bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white   shadow-blue-600/25 hover:bg-blue-500 transition-colors"
            >
              Experimentar grátis
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
