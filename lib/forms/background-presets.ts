/**
 * Paleta fixa de fundos escuros para o formulário público — sempre com um
 * leve gradiente, nunca cor sólida lisa. Restrita a tons escuros de propósito:
 * o texto do formulário é sempre branco/cinza-claro, então o fundo precisa
 * garantir contraste em qualquer escolha (não é um color picker livre).
 */
export type FormBackgroundPreset = 'black' | 'navy' | 'brown' | 'green' | 'red'

export const DEFAULT_FORM_BACKGROUND: FormBackgroundPreset = 'black'

export const FORM_BACKGROUND_PRESETS: Record<
  FormBackgroundPreset,
  { label: string; gradient: string; swatch: string }
> = {
  black: { label: 'Preto', gradient: 'linear-gradient(160deg, #262626 0%, #0a0a0a 100%)', swatch: '#1a1a1a' },
  navy: { label: 'Azul-marinho', gradient: 'linear-gradient(160deg, #1a2f5c 0%, #060f24 100%)', swatch: '#0f1f45' },
  brown: { label: 'Marrom escuro', gradient: 'linear-gradient(160deg, #3a2417 0%, #170d08 100%)', swatch: '#2b1a10' },
  green: { label: 'Verde escuro', gradient: 'linear-gradient(160deg, #16362a 0%, #061410 100%)', swatch: '#0f2a20' },
  red: { label: 'Vermelho escuro', gradient: 'linear-gradient(160deg, #4a1620 0%, #1c0608 100%)', swatch: '#3a1119' },
}

export function resolveFormBackground(preset?: string | null): string {
  const key = (preset as FormBackgroundPreset) in FORM_BACKGROUND_PRESETS ? (preset as FormBackgroundPreset) : DEFAULT_FORM_BACKGROUND
  return FORM_BACKGROUND_PRESETS[key].gradient
}
