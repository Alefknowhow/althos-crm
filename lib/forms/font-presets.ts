/** Fontes disponíveis pro formulário público — carregadas via Google Fonts.
 *  `google` é o parâmetro de família usado na URL do CDN; `stack` é o
 *  font-family CSS aplicado (com fallback). */
export type FormFontPreset = 'inter' | 'poppins' | 'montserrat' | 'space_grotesk' | 'playfair'

export const DEFAULT_FORM_FONT: FormFontPreset = 'space_grotesk'

export const FORM_FONT_PRESETS: Record<FormFontPreset, { label: string; google: string; stack: string }> = {
  inter:         { label: 'Inter',          google: 'Inter:wght@400;500;600;700',          stack: `'Inter', sans-serif` },
  poppins:       { label: 'Poppins',        google: 'Poppins:wght@400;500;600;700',        stack: `'Poppins', sans-serif` },
  montserrat:    { label: 'Montserrat',     google: 'Montserrat:wght@400;500;600;700',     stack: `'Montserrat', sans-serif` },
  space_grotesk: { label: 'Space Grotesk',  google: 'Space+Grotesk:wght@400;500;600;700',  stack: `'Space Grotesk', sans-serif` },
  playfair:      { label: 'Playfair Display (serifada)', google: 'Playfair+Display:wght@400;600;700', stack: `'Playfair Display', serif` },
}

export function resolveFormFontStack(preset?: string | null): string {
  const key = (preset as FormFontPreset) in FORM_FONT_PRESETS ? (preset as FormFontPreset) : DEFAULT_FORM_FONT
  return FORM_FONT_PRESETS[key].stack
}

/** URL do Google Fonts CSS pra carregar todas as fontes (só o preset ativo,
 *  chamado com um único key). */
export function googleFontsHref(preset?: string | null): string {
  const key = (preset as FormFontPreset) in FORM_FONT_PRESETS ? (preset as FormFontPreset) : DEFAULT_FORM_FONT
  return `https://fonts.googleapis.com/css2?family=${FORM_FONT_PRESETS[key].google}&display=swap`
}
