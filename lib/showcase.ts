// Classificações da Vitrine. O `value` é persistido em
// travel_showcase_packages.category; o `label` é exibido na UI.
export const SHOWCASE_CATEGORIES = [
  { value: 'europa', label: 'Europa' },
  { value: 'asia', label: 'Ásia' },
  { value: 'america_do_sul', label: 'América do Sul' },
  { value: 'america_do_norte', label: 'América do Norte' },
  { value: 'caribe', label: 'Caribe' },
  { value: 'resorts', label: 'Resorts' },
  { value: 'lua_de_mel', label: 'Lua de Mel' },
  { value: 'nacionais', label: 'Nacionais' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'africa', label: 'África' },
  { value: 'roteiros_especiais', label: 'Roteiros Especiais' },
] as const

export type ShowcaseCategory = (typeof SHOWCASE_CATEGORIES)[number]['value']

const CATEGORY_LABEL = new Map<string, string>(SHOWCASE_CATEGORIES.map(c => [c.value, c.label]))

export function categoryLabel(value?: string | null): string {
  if (!value) return 'Sem categoria'
  return CATEGORY_LABEL.get(value) || value
}

// Ordena uma lista de categorias seguindo a ordem canônica de SHOWCASE_CATEGORIES;
// categorias desconhecidas (ou nulas) vão para o fim.
export function sortCategories(values: (string | null | undefined)[]): string[] {
  const order = new Map<string, number>(SHOWCASE_CATEGORIES.map((c, i) => [c.value, i]))
  return Array.from(new Set(values.map(v => v || '__none')))
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}

// Extrai o ID de um vídeo do YouTube a partir das URLs mais comuns
// (watch?v=, youtu.be/, /embed/, /shorts/) e devolve a URL de embed.
export function youtubeEmbedUrl(raw?: string | null): string | null {
  if (!raw) return null
  const url = raw.trim()
  if (!url) return null
  let id = ''
  try {
    const m =
      url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
      url.match(/[?&]v=([A-Za-z0-9_-]{11})/)
    if (m) id = m[1]
    else if (/^[A-Za-z0-9_-]{11}$/.test(url)) id = url
  } catch {
    /* ignore */
  }
  return id ? `https://www.youtube.com/embed/${id}` : null
}
