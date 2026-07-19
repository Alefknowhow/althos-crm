import type { BlogCategory } from '@/lib/blog/posts'

/**
 * Capa ilustrada por categoria (sem depender de banco de fotos real).
 * Cada categoria tem uma cor e um ícone fixos — visual limpo e consistente
 * em vez de fotos de banco de imagens genéricas.
 */
const CATEGORY_ART: Record<BlogCategory, { color: string; path: string }> = {
  'Meta Ads': {
    color: '#ee5396',
    path: 'M3 11v2a2 2 0 002 2h1l2 5h2l-1.5-5H10l8 4V6l-8 4H6a2 2 0 00-2 2z M10 10V6',
  },
  'Google Ads': {
    color: '#1192e8',
    path: 'M11 4a7 7 0 104.9 12l4.1 4 1.4-1.4-4.1-4A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z',
  },
  'Funil de Vendas': {
    color: '#0f62fe',
    path: 'M4 5h16l-6 8v5l-4 2v-7z',
  },
  'Gestão de Equipe': {
    color: '#8a3ffc',
    path: 'M9 12a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 4v1h12v-1c0-2.5-3-4-6-4zm8-4a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 1.3c-.7 0-1.4.1-2 .4 1.3.9 2 2.2 2 3.8v1h5v-1c0-2.2-2.2-4.2-5-4.2z',
  },
  'Treinamento de Vendas': {
    color: '#f1c21b',
    path: 'M12 3L2 8l10 5 8-4v6h2V8zM6 12.5v3.7c0 1.6 2.7 2.8 6 2.8s6-1.2 6-2.8v-3.7l-6 3z',
  },
  'WhatsApp API': {
    color: '#24a148',
    path: 'M12 3a9 9 0 00-7.8 13.4L3 21l4.7-1.2A9 9 0 1012 3zm0 2a7 7 0 11-3.9 12.8l-.4-.2-2.6.7.7-2.5-.2-.4A7 7 0 0112 5z',
  },
}

export function BlogCoverArt({ category, className = '', iconSize = 40 }: { category: BlogCategory; className?: string; iconSize?: number }) {
  const art = CATEGORY_ART[category] ?? CATEGORY_ART['Funil de Vendas']
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(140deg, ${art.color}26, ${art.color}08)` }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={iconSize * 2.4}
        height={iconSize * 2.4}
        fill={art.color}
        opacity={0.14}
        className="absolute -bottom-3 -right-3"
      >
        <path d={art.path} />
      </svg>
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill={art.color} className="relative">
        <path d={art.path} />
      </svg>
    </div>
  )
}
