'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import {
  readCookieConsent, writeCookieConsent, type CookieConsent,
} from '@/lib/legal/cookie-consent'

const TOGGLE_ITEMS: { key: keyof Omit<CookieConsent, 'necessary' | 'decidedAt'>; label: string; description: string }[] = [
  {
    key: 'preferences',
    label: 'Preferências',
    description: 'Lembram escolhas como tema e a dispensa de avisos, pra personalizar sua visita.',
  },
  {
    key: 'analytics',
    label: 'Analíticos / desempenho',
    description: 'Ajudam a entender como o site é usado, de forma agregada, pra melhorarmos a experiência.',
  },
  {
    key: 'thirdParty',
    label: 'Funcionais de terceiros',
    description: 'Recursos viabilizados por serviços integrados (ex.: mensageria, infraestrutura).',
  },
]

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [managing, setManaging] = useState(false)
  const [choices, setChoices] = useState({ preferences: true, analytics: true, thirdParty: true })

  useEffect(() => {
    setVisible(!readCookieConsent())
  }, [])

  function acceptAll() {
    writeCookieConsent({ preferences: true, analytics: true, thirdParty: true })
    setVisible(false)
  }

  function rejectNonEssential() {
    writeCookieConsent({ preferences: false, analytics: false, thirdParty: false })
    setVisible(false)
  }

  function saveChoices() {
    writeCookieConsent(choices)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-none border border-[#383838] bg-[#1f1f1f] shadow-2xl">
        {!managing ? (
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <Cookie className="w-6 h-6 text-[#78a9ff] shrink-0 hidden sm:block" />
            <p className="text-[13px] leading-relaxed text-[#c6c6c6] flex-1">
              Usamos cookies essenciais para o funcionamento do site e, com sua permissão, cookies de
              preferências e desempenho para melhorar sua experiência. Veja detalhes na nossa{' '}
              <Link href="/cookies" className="text-[#78a9ff] underline hover:text-[#a6c8ff]">
                Política de Cookies
              </Link>.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setManaging(true)}
                className="px-3.5 py-2 text-[13px] font-medium text-[#c6c6c6] hover:text-white transition-colors"
              >
                Gerenciar preferências
              </button>
              <button
                onClick={rejectNonEssential}
                className="px-3.5 py-2 rounded-none border border-[#525252] bg-transparent text-[13px] font-semibold text-[#d4d4d4] hover:border-[#78a9ff] hover:bg-[#262626] transition-colors"
              >
                Rejeitar não essenciais
              </button>
              <button
                onClick={acceptAll}
                className="px-3.5 py-2 rounded-none bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Aceitar todos
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#f4f4f4]">Preferências de cookies</p>
              <button onClick={() => setManaging(false)} aria-label="Fechar" className="text-[#8d8d8d] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-start justify-between gap-3 opacity-70">
                <div>
                  <p className="text-[13px] font-medium text-[#f4f4f4]">Estritamente necessários</p>
                  <p className="text-xs text-[#8d8d8d]">Essenciais para login, sessão e segurança — sempre ativos.</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-[#8d8d8d] mt-0.5">Sempre ativo</span>
              </div>

              {TOGGLE_ITEMS.map(item => (
                <label key={item.key} className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-[13px] font-medium text-[#f4f4f4]">{item.label}</p>
                    <p className="text-xs text-[#8d8d8d]">{item.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={choices[item.key]}
                    onChange={e => setChoices(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={rejectNonEssential}
                className="px-3.5 py-2 rounded-none border border-[#525252] bg-transparent text-[13px] font-semibold text-[#d4d4d4] hover:border-[#78a9ff] hover:bg-[#262626] transition-colors"
              >
                Rejeitar não essenciais
              </button>
              <button
                onClick={saveChoices}
                className="px-3.5 py-2 rounded-none bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Salvar preferências
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
