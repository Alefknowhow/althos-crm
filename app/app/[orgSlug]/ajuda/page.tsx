import { HELP_CATEGORIES } from '@/lib/help/content'
import { AjudaClient } from './AjudaClient'

export const metadata = { title: 'Central de Ajuda · Althos CRM' }

export default function AjudaPage() {
  return <AjudaClient categories={HELP_CATEGORIES} />
}
