/**
 * Envio/consulta de templates HSM direto na API do WhatsApp — usa o
 * whatsapp_waba_id da org (diferente do phone_number_id, usado só pra
 * enviar mensagens).
 */

const GRAPH_VERSION = 'v26.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export type MetaTemplatePayload = {
  name: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  language: string
  headerType: 'none' | 'text' | 'image' | 'video' | 'document'
  headerText?: string | null
  headerMediaUrl?: string | null
  bodyText: string
  footerText?: string | null
}

/** Faz upload da mídia do cabeçalho pra Meta e devolve o `header_handle`
 * exigido pelo componente HEADER — a API de templates não aceita URL
 * pública direto como as mensagens avulsas aceitam. */
async function uploadHeaderHandle(wabaId: string, accessToken: string, mediaUrl: string, _headerType: string): Promise<string> {
  // 1. Baixa o arquivo do nosso Storage.
  const fileRes = await fetch(mediaUrl)
  if (!fileRes.ok) throw new Error('Não foi possível baixar a mídia do cabeçalho.')
  const blob = await fileRes.blob()

  // 2. Cria uma sessão de upload resumable na Meta.
  const appId = process.env.META_APP_ID
  const sessionRes = await fetch(
    `${GRAPH}/${appId}/uploads?file_length=${blob.size}&file_type=${encodeURIComponent(blob.type)}&access_token=${accessToken}`,
    { method: 'POST' },
  )
  const sessionJson = await sessionRes.json()
  if (!sessionRes.ok || !sessionJson.id) {
    throw new Error(sessionJson?.error?.message || 'Falha ao iniciar upload da mídia do cabeçalho.')
  }

  // 3. Sobe o arquivo.
  const uploadRes = await fetch(`${GRAPH}/${sessionJson.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      'file_offset': '0',
    },
    body: blob,
  })
  const uploadJson = await uploadRes.json()
  if (!uploadRes.ok || !uploadJson.h) {
    throw new Error(uploadJson?.error?.message || 'Falha ao enviar a mídia do cabeçalho pra Meta.')
  }
  return uploadJson.h as string
}

export async function createMetaTemplate(
  wabaId: string,
  accessToken: string,
  payload: MetaTemplatePayload,
): Promise<{ id: string; status: string; category: string }> {
  const components: Record<string, any>[] = []

  if (payload.headerType === 'text' && payload.headerText) {
    components.push({ type: 'HEADER', format: 'TEXT', text: payload.headerText })
  } else if (['image', 'video', 'document'].includes(payload.headerType) && payload.headerMediaUrl) {
    const handle = await uploadHeaderHandle(wabaId, accessToken, payload.headerMediaUrl, payload.headerType)
    components.push({ type: 'HEADER', format: payload.headerType.toUpperCase(), example: { header_handle: [handle] } })
  }

  const bodyVars = payload.bodyText.match(/\{\{\d+\}\}/g)
  const bodyComponent: Record<string, any> = { type: 'BODY', text: payload.bodyText }
  if (bodyVars && bodyVars.length > 0) {
    bodyComponent.example = { body_text: [bodyVars.map((_, i) => `exemplo${i + 1}`)] }
  }
  components.push(bodyComponent)

  if (payload.footerText) {
    components.push({ type: 'FOOTER', text: payload.footerText })
  }

  const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      category: payload.category,
      language: payload.language,
      components,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.error_user_msg || json?.error?.message || 'Falha ao enviar template pra aprovação.')
  return json
}

export async function getMetaTemplateStatus(
  wabaId: string,
  accessToken: string,
  templateId: string,
): Promise<{ status: string; rejected_reason?: string | null }> {
  const res = await fetch(`${GRAPH}/${templateId}?fields=status,rejected_reason`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Falha ao consultar status do template.')
  return json
}
