export const SHOTS = {
  pipeline: '/home/screen-pipeline.png',
  dashboard: '/home/screen-dashboard.png',
  automacoes: '/home/screen-automacoes.png',
  insights: '/home/screen-insights.png',
  tasks: '/home/screen-tasks.png',
} as const

export type ZoomImg = { src: string; alt: string } | null
export type OnZoom = (src: string, alt: string) => void

export const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg>
export const CROSS = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M18 6L6 18M6 6l12 12" /></svg>

export const nBR = (v: number) => v.toLocaleString('pt-BR')
