/**
 * Site nav links. Split out of lib/site/content.ts.
 */

export interface NavItem {
  label: string
  href: string
}

/** Links de navegação do site multi-página. */
export const SITE_NAV: NavItem[] = [
  { label: 'Funcionalidades', href: '/funcionalidades' },
  { label: 'Por que nós?',    href: '/por-que-nos' },
  { label: 'Como funciona',   href: '/como-funciona' },
  { label: 'Planos',          href: '/planos' },
  { label: 'FAQ',             href: '/faq' },
  { label: 'Blog',            href: '/blog' },
]
