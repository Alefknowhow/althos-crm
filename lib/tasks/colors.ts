export const TASK_COLOR_IDS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'cyan'] as const
export type TaskColor = typeof TASK_COLOR_IDS[number]
export const DEFAULT_TASK_COLOR: TaskColor = 'blue'

export const TASK_COLORS: { id: TaskColor; label: string; className: string }[] = [
  { id: 'blue', label: 'Azul', className: 'bg-blue-600 text-white' },
  { id: 'indigo', label: 'Índigo', className: 'bg-indigo-600 text-white' },
  { id: 'violet', label: 'Violeta', className: 'bg-violet-600 text-white' },
  { id: 'pink', label: 'Rosa', className: 'bg-pink-600 text-white' },
  { id: 'red', label: 'Vermelho', className: 'bg-red-600 text-white' },
  { id: 'orange', label: 'Laranja', className: 'bg-orange-400 text-black' },
  { id: 'amber', label: 'Amarelo', className: 'bg-amber-400 text-black' },
  { id: 'green', label: 'Verde', className: 'bg-green-700 text-white' },
  { id: 'teal', label: 'Verde-azulado', className: 'bg-teal-700 text-white' },
  { id: 'cyan', label: 'Ciano', className: 'bg-cyan-400 text-black' },
]

export function taskColor(color?: string | null) {
  return TASK_COLORS.find(option => option.id === color) ?? TASK_COLORS[0]
}
