'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { FAQ, FAQ_CATEGORIES } from '@/lib/site/content'

export function FaqAccordion() {
  const [open, setOpen] = useState<string | null>(FAQ[0].question)

  return (
    <div className="space-y-10">
      {FAQ_CATEGORIES.map(cat => {
        const items = FAQ.filter(f => f.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-[#0043ce]">{cat}</h2>
            <div className="space-y-2.5">
              {items.map(item => {
                const isOpen = open === item.question
                return (
                  <div
                    key={item.question}
                    className={`rounded-none border transition-colors ${
                      isOpen ? 'border-[#78a9ff] bg-[#edf5ff]' : 'border-slate-200 bg-white  '
                    }`}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : item.question)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-[14px] font-medium text-slate-900">{item.question}</span>
                      <ChevronDown
                        className={`h-4.5 w-4.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-4 text-[13px] leading-relaxed text-slate-600">{item.answer}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
