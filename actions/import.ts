'use server'

import { inngest } from '@/lib/inngest/client'
import { getCurrentOrganization, requireAuth } from '@/lib/supabase/types'

export async function triggerCsvImport(orgSlug: string, rows: any[], mapping: any) {
  const org = await getCurrentOrganization(orgSlug)
  const user = await requireAuth()

  await inngest.send({
    name: 'leads.import_csv',
    data: {
      orgId: org.id,
      userId: user.id,
      rows,
      mapping
    }
  })

  return { ok: true }
}
