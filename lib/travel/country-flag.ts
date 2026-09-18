/**
 * Bandeira (emoji) a partir do nome do país (PT-BR) — usado no painel de
 * Gestão de Viagens (lista de embarques) pra identificação visual rápida do
 * destino. Cobre os países mais comuns pra uma agência de viagens brasileira
 * (mesma cobertura de `lib/airports.ts`); sem entrada = sem bandeira.
 */
const COUNTRY_FLAG: Record<string, string> = {
  'brasil': '🇧🇷',
  'argentina': '🇦🇷', 'chile': '🇨🇱', 'peru': '🇵🇪', 'colômbia': '🇨🇴',
  'equador': '🇪🇨', 'uruguai': '🇺🇾', 'paraguai': '🇵🇾', 'bolívia': '🇧🇴',
  'méxico': '🇲🇽', 'república dominicana': '🇩🇴', 'cuba': '🇨🇺',
  'bahamas': '🇧🇸', 'panamá': '🇵🇦', 'costa rica': '🇨🇷', 'aruba': '🇦🇼',
  'curaçao': '🇨🇼', 'jamaica': '🇯🇲', 'porto rico': '🇵🇷',
  'estados unidos': '🇺🇸', 'eua': '🇺🇸', 'canadá': '🇨🇦',
  'portugal': '🇵🇹', 'espanha': '🇪🇸', 'frança': '🇫🇷', 'itália': '🇮🇹',
  'reino unido': '🇬🇧', 'inglaterra': '🇬🇧', 'alemanha': '🇩🇪',
  'holanda': '🇳🇱', 'países baixos': '🇳🇱', 'suíça': '🇨🇭', 'grécia': '🇬🇷',
  'turquia': '🇹🇷', 'emirados árabes unidos': '🇦🇪', 'catar': '🇶🇦',
  'japão': '🇯🇵', 'tailândia': '🇹🇭', 'china': '🇨🇳', 'áustria': '🇦🇹',
  'irlanda': '🇮🇪', 'bélgica': '🇧🇪', 'marrocos': '🇲🇦', 'egito': '🇪🇬',
  'austrália': '🇦🇺', 'nova zelândia': '🇳🇿', 'índia': '🇮🇳',
}

export function flagForCountry(country?: string | null): string | null {
  if (!country) return null
  return COUNTRY_FLAG[country.trim().toLowerCase()] || null
}
