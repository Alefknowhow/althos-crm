import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAutentiqueDocumentStatus } from '@/lib/autentique'

// Webhook global da Autentique — cada organização registra essa mesma URL no
// próprio painel (Configurações de Desenvolvedor > Webhooks) usando sua conta.
// O payload não carrega nosso organization_id, então o roteamento é feito
// casando event.data.document (id do documento na Autentique) com a coluna
// autentique_document_id salva em sale_contracts na hora do envio.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const eventType = body?.event?.type as string | undefined
  const documentId = body?.event?.data?.document as string | undefined

  if (eventType === 'signature.accepted' && documentId) {
    const supabase = createAdminClient()

    const { data: contract } = await supabase
      .from('sale_contracts')
      .select('id, sale_id, organization_id')
      .eq('autentique_document_id', documentId)
      .maybeSingle()

    if (contract) {
      const { data: org } = await supabase
        .from('organizations')
        .select('autentique_api_key')
        .eq('id', contract.organization_id)
        .maybeSingle()

      let signedPdfPath: string | null = null
      if (org?.autentique_api_key) {
        try {
          const doc = await getAutentiqueDocumentStatus(org.autentique_api_key, documentId)
          signedPdfPath = doc?.files?.signed || null
        } catch (e) {
          console.error('autentique webhook: falha ao buscar PDF assinado', e)
        }
      }

      const now = new Date().toISOString()
      await supabase
        .from('sale_contracts')
        .update({
          status: 'signed',
          signed_at: now,
          updated_at: now,
          ...(signedPdfPath ? { signed_pdf_path: signedPdfPath } : {}),
        })
        .eq('id', contract.id)
      await supabase
        .from('travel_sales')
        .update({ contrato_assinado_at: now })
        .eq('id', contract.sale_id)
        .eq('organization_id', contract.organization_id)
    }
  }

  return NextResponse.json({ ok: true })
}
