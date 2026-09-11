/**
 * Base curada de países pra recursos que precisam de coordenada/ISO2 sem
 * depender de geocoding externo — hoje usada pelo Mapa animado de Cotações
 * (`lib/geo/cities.ts`, `AnimatedMapBlockInner.tsx`). País continua sendo
 * digitado como texto livre no editor (decisão de produto); `resolveCountry`
 * é quem tenta casar esse texto contra um país conhecido.
 *
 * `enName` é o nome em inglês exatamente como aparece no dataset topojson
 * `world-atlas/countries-110m.json` (Natural Earth) — usado só pra achar o
 * contorno do país no mapa. Países pequenos demais pra ter polígono nessa
 * resolução (ex.: Maldivas, Singapura) ficam sem `enName`; o mapa ainda
 * mostra o pino/bandeira nesses casos, só sem pintar um contorno.
 */

export type CountryInfo = { iso2: string; name: string; enName?: string; lat: number; lng: number }

/** Centróide aproximado (bom o bastante pra plotar um pino/pintura decorativa,
 *  não pra cálculo geográfico preciso). */
export const COUNTRIES: CountryInfo[] = [
  { iso2: 'br', name: 'Brasil', enName: 'Brazil', lat: -14.235, lng: -51.9253 },
  { iso2: 'ar', name: 'Argentina', enName: 'Argentina', lat: -38.4161, lng: -63.6167 },
  { iso2: 'cl', name: 'Chile', enName: 'Chile', lat: -35.6751, lng: -71.543 },
  { iso2: 'uy', name: 'Uruguai', enName: 'Uruguay', lat: -32.5228, lng: -55.7658 },
  { iso2: 'py', name: 'Paraguai', enName: 'Paraguay', lat: -23.4425, lng: -58.4438 },
  { iso2: 'bo', name: 'Bolívia', enName: 'Bolivia', lat: -16.2902, lng: -63.5887 },
  { iso2: 'pe', name: 'Peru', enName: 'Peru', lat: -9.19, lng: -75.0152 },
  { iso2: 'co', name: 'Colômbia', enName: 'Colombia', lat: 4.5709, lng: -74.2973 },
  { iso2: 've', name: 'Venezuela', enName: 'Venezuela', lat: 6.4238, lng: -66.5897 },
  { iso2: 'ec', name: 'Equador', enName: 'Ecuador', lat: -1.8312, lng: -78.1834 },
  { iso2: 'mx', name: 'México', enName: 'Mexico', lat: 23.6345, lng: -102.5528 },
  { iso2: 'us', name: 'Estados Unidos', enName: 'United States of America', lat: 37.0902, lng: -95.7129 },
  { iso2: 'ca', name: 'Canadá', enName: 'Canada', lat: 56.1304, lng: -106.3468 },
  { iso2: 'cu', name: 'Cuba', enName: 'Cuba', lat: 21.5218, lng: -77.7812 },
  { iso2: 'do', name: 'República Dominicana', enName: 'Dominican Rep.', lat: 18.7357, lng: -70.1627 },
  { iso2: 'jm', name: 'Jamaica', enName: 'Jamaica', lat: 18.1096, lng: -77.2975 },
  { iso2: 'bs', name: 'Bahamas', enName: 'Bahamas', lat: 25.0343, lng: -77.3963 },
  { iso2: 'pt', name: 'Portugal', enName: 'Portugal', lat: 39.3999, lng: -8.2245 },
  { iso2: 'es', name: 'Espanha', enName: 'Spain', lat: 40.4637, lng: -3.7492 },
  { iso2: 'fr', name: 'França', enName: 'France', lat: 46.2276, lng: 2.2137 },
  { iso2: 'it', name: 'Itália', enName: 'Italy', lat: 41.8719, lng: 12.5674 },
  { iso2: 'de', name: 'Alemanha', enName: 'Germany', lat: 51.1657, lng: 10.4515 },
  { iso2: 'gb', name: 'Reino Unido', enName: 'United Kingdom', lat: 55.3781, lng: -3.436 },
  { iso2: 'ie', name: 'Irlanda', enName: 'Ireland', lat: 53.1424, lng: -7.6921 },
  { iso2: 'nl', name: 'Holanda', enName: 'Netherlands', lat: 52.1326, lng: 5.2913 },
  { iso2: 'be', name: 'Bélgica', enName: 'Belgium', lat: 50.5039, lng: 4.4699 },
  { iso2: 'ch', name: 'Suíça', enName: 'Switzerland', lat: 46.8182, lng: 8.2275 },
  { iso2: 'at', name: 'Áustria', enName: 'Austria', lat: 47.5162, lng: 14.5501 },
  { iso2: 'gr', name: 'Grécia', enName: 'Greece', lat: 39.0742, lng: 21.8243 },
  { iso2: 'tr', name: 'Turquia', enName: 'Turkey', lat: 38.9637, lng: 35.2433 },
  { iso2: 'hr', name: 'Croácia', enName: 'Croatia', lat: 45.1, lng: 15.2 },
  { iso2: 'cz', name: 'República Tcheca', enName: 'Czechia', lat: 49.8175, lng: 15.473 },
  { iso2: 'pl', name: 'Polônia', enName: 'Poland', lat: 51.9194, lng: 19.1451 },
  { iso2: 'hu', name: 'Hungria', enName: 'Hungary', lat: 47.1625, lng: 19.5033 },
  { iso2: 'se', name: 'Suécia', enName: 'Sweden', lat: 60.1282, lng: 18.6435 },
  { iso2: 'no', name: 'Noruega', enName: 'Norway', lat: 60.472, lng: 8.4689 },
  { iso2: 'dk', name: 'Dinamarca', enName: 'Denmark', lat: 56.2639, lng: 9.5018 },
  { iso2: 'fi', name: 'Finlândia', enName: 'Finland', lat: 61.9241, lng: 25.7482 },
  { iso2: 'is', name: 'Islândia', enName: 'Iceland', lat: 64.9631, lng: -19.0208 },
  { iso2: 'ru', name: 'Rússia', enName: 'Russia', lat: 61.524, lng: 105.3188 },
  { iso2: 'ae', name: 'Emirados Árabes Unidos', enName: 'United Arab Emirates', lat: 23.4241, lng: 53.8478 },
  { iso2: 'qa', name: 'Catar', enName: 'Qatar', lat: 25.3548, lng: 51.1839 },
  { iso2: 'sa', name: 'Arábia Saudita', enName: 'Saudi Arabia', lat: 23.8859, lng: 45.0792 },
  { iso2: 'il', name: 'Israel', enName: 'Israel', lat: 31.0461, lng: 34.8516 },
  { iso2: 'eg', name: 'Egito', enName: 'Egypt', lat: 26.8206, lng: 30.8025 },
  { iso2: 'ma', name: 'Marrocos', enName: 'Morocco', lat: 31.7917, lng: -7.0926 },
  { iso2: 'za', name: 'África do Sul', enName: 'South Africa', lat: -30.5595, lng: 22.9375 },
  { iso2: 'cn', name: 'China', enName: 'China', lat: 35.8617, lng: 104.1954 },
  { iso2: 'jp', name: 'Japão', enName: 'Japan', lat: 36.2048, lng: 138.2529 },
  { iso2: 'kr', name: 'Coreia do Sul', enName: 'South Korea', lat: 35.9078, lng: 127.7669 },
  { iso2: 'th', name: 'Tailândia', enName: 'Thailand', lat: 15.87, lng: 100.9925 },
  { iso2: 'vn', name: 'Vietnã', enName: 'Vietnam', lat: 14.0583, lng: 108.2772 },
  { iso2: 'id', name: 'Indonésia', enName: 'Indonesia', lat: -0.7893, lng: 113.9213 },
  { iso2: 'in', name: 'Índia', enName: 'India', lat: 20.5937, lng: 78.9629 },
  { iso2: 'sg', name: 'Singapura', lat: 1.3521, lng: 103.8198 },
  { iso2: 'my', name: 'Malásia', enName: 'Malaysia', lat: 4.2105, lng: 101.9758 },
  { iso2: 'ph', name: 'Filipinas', enName: 'Philippines', lat: 12.8797, lng: 121.774 },
  { iso2: 'mv', name: 'Maldivas', lat: 3.2028, lng: 73.2207 },
  { iso2: 'au', name: 'Austrália', enName: 'Australia', lat: -25.2744, lng: 133.7751 },
  { iso2: 'nz', name: 'Nova Zelândia', enName: 'New Zealand', lat: -40.9006, lng: 174.886 },
  { iso2: 'pf', name: 'Polinésia Francesa', lat: -17.6797, lng: -149.4068 },
  { iso2: 'cr', name: 'Costa Rica', enName: 'Costa Rica', lat: 9.7489, lng: -83.7534 },
  { iso2: 'pa', name: 'Panamá', enName: 'Panama', lat: 8.538, lng: -80.7821 },
  { iso2: 'gt', name: 'Guatemala', enName: 'Guatemala', lat: 15.7835, lng: -90.2308 },
]

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Apelidos/variações comuns → nome canônico (já normalizado) em COUNTRIES. */
const ALIASES: Record<string, string> = {
  eua: 'estados unidos',
  usa: 'estados unidos',
  'united states': 'estados unidos',
  'united states of america': 'estados unidos',
  uk: 'reino unido',
  'united kingdom': 'reino unido',
  england: 'reino unido',
  inglaterra: 'reino unido',
  holland: 'holanda',
  netherlands: 'holanda',
  'países baixos': 'holanda',
  espana: 'espanha',
  spain: 'espanha',
  italy: 'itália',
  italia: 'itália',
  france: 'frança',
  franca: 'frança',
  germany: 'alemanha',
  deutschland: 'alemanha',
  greece: 'grécia',
  grecia: 'grécia',
  switzerland: 'suíça',
  suica: 'suíça',
  austria: 'áustria',
  japan: 'japão',
  japao: 'japão',
  mexico: 'méxico',
  méxico: 'méxico',
  'republica dominicana': 'república dominicana',
  'emirados arabes unidos': 'emirados árabes unidos',
  dubai: 'emirados árabes unidos',
  'arabia saudita': 'arábia saudita',
  vietnam: 'vietnã',
  indonesia: 'indonésia',
  india: 'índia',
  maldives: 'maldivas',
  australia: 'austrália',
  'nova zelandia': 'nova zelândia',
}

const BY_NORMALIZED_NAME = new Map(COUNTRIES.map(c => [norm(c.name), c]))

/** Tenta casar um texto livre (o que o usuário digitou) contra um país
 *  conhecido — usado só pra resolver coordenada/bandeira do Mapa animado,
 *  nunca pra validar/bloquear o campo de texto em si. */
export function resolveCountry(input: string | null | undefined): CountryInfo | null {
  if (!input) return null
  const n = norm(input)
  if (!n) return null
  const direct = BY_NORMALIZED_NAME.get(n)
  if (direct) return direct
  const aliased = ALIASES[n]
  if (aliased) return BY_NORMALIZED_NAME.get(aliased) ?? null
  return null
}
