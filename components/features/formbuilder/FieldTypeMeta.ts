import {
  CircleDot, Type, AlignLeft, Mail, Phone, Hash, ChevronDown,
  ListChecks, CheckSquare, Calendar,
} from 'lucide-react'
import type { FieldType } from '../PublicFormPreview'

export type FieldTypeDef = {
  type: FieldType
  label: string
  icon: typeof Type
  colorClass: string
}

/** Fonte única de ícone/cor/rótulo por tipo de pergunta — usada pelos pills
 *  da sidebar de páginas e pelo seletor de tipo no painel de propriedades. */
export const FIELD_TYPES: FieldTypeDef[] = [
  { type: 'short_text',   label: 'Texto Curto',            icon: Type,        colorClass: 'bg-blue-100 text-blue-700' },
  { type: 'long_text',    label: 'Texto Longo',            icon: AlignLeft,   colorClass: 'bg-blue-100 text-blue-700' },
  { type: 'email',        label: 'E-mail',                 icon: Mail,        colorClass: 'bg-rose-100 text-rose-700' },
  { type: 'phone',        label: 'Telefone',                icon: Phone,       colorClass: 'bg-rose-100 text-rose-700' },
  { type: 'number',       label: 'Número',                  icon: Hash,        colorClass: 'bg-amber-100 text-amber-700' },
  { type: 'date',         label: 'Data',                    icon: Calendar,    colorClass: 'bg-amber-100 text-amber-700' },
  { type: 'single_choice',label: 'Múltipla Escolha (cards)', icon: CircleDot,   colorClass: 'bg-violet-100 text-violet-700' },
  { type: 'select',       label: 'Select (Dropdown)',       icon: ChevronDown, colorClass: 'bg-violet-100 text-violet-700' },
  { type: 'multi_select', label: 'Múltipla Escolha (várias)', icon: ListChecks, colorClass: 'bg-violet-100 text-violet-700' },
  { type: 'checkbox',     label: 'Checkbox',                icon: CheckSquare, colorClass: 'bg-green-100 text-green-700' },
]

const BY_TYPE: Record<string, FieldTypeDef> = Object.fromEntries(FIELD_TYPES.map(f => [f.type, f]))

export function getFieldTypeDef(type: string): FieldTypeDef {
  return BY_TYPE[type] || FIELD_TYPES[0]
}
