'use client'

import { useEffect } from 'react'
import { googleFontsHref } from './font-presets'

/** Injeta/atualiza a tag <link> do Google Fonts no <head> conforme o preset
 *  muda — usado só no preview do editor (a página pública real já injeta
 *  o <link> no server-render). */
export function useGoogleFont(preset?: string | null) {
  useEffect(() => {
    const href = googleFontsHref(preset)
    const id = 'formbuilder-google-font'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  }, [preset])
}
