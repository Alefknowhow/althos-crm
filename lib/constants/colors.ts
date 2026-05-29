/**
 * Preset primary-color palette shared between the server layout
 * (for CSS injection) and the client AppearanceTab component.
 *
 * Kept in a plain module (no 'use client' / 'use server') so it can be
 * imported from both server components and client components safely.
 */
export const PRESET_COLORS = [
  { name: 'Índigo',    hex: '#4F46E5', hsl: '245 75% 59%' },
  { name: 'Azul',      hex: '#2563EB', hsl: '221 83% 53%' },
  { name: 'Ciano',     hex: '#0891B2', hsl: '197 89% 36%' },
  { name: 'Verde',     hex: '#16A34A', hsl: '142 72% 29%' },
  { name: 'Esmeralda', hex: '#059669', hsl: '161 94% 30%' },
  { name: 'Violeta',   hex: '#7C3AED', hsl: '263 70% 50%' },
  { name: 'Rosa',      hex: '#DB2777', hsl: '328 85% 50%' },
  { name: 'Vermelho',  hex: '#DC2626', hsl: '0 72% 51%'   },
  { name: 'Laranja',   hex: '#EA580C', hsl: '22 96% 48%'  },
  { name: 'Âmbar',     hex: '#D97706', hsl: '38 92% 50%'  },
  { name: 'Ardósia',   hex: '#475569', hsl: '215 19% 35%' },
  { name: 'Escuro',    hex: '#0F172A', hsl: '222 47% 11%' },
] as const

export type PresetColor = (typeof PRESET_COLORS)[number]
