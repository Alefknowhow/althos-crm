export async function sendTextMessage(orgConfig: any, to: string, text: string) {
  if (!orgConfig.whatsapp_phone_number_id || !orgConfig.whatsapp_access_token || orgConfig.whatsapp_access_token === 'mock') {
    console.log(`[MOCK WHATSAPP] To: ${to} | Text: ${text}`)
    return { messages: [{ id: `wamid.MOCK_${Date.now()}` }] }
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${orgConfig.whatsapp_phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConfig.whatsapp_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text }
    })
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro na API do Meta')
  }
  return res.json()
}

export async function sendTemplateMessage(
  orgConfig: any,
  to: string,
  templateName: string,
  variables: string[],
  languageCode = 'pt_BR',
  headerType?: 'image' | 'video' | 'document' | string,
  headerMediaUrl?: string,
) {
  if (!orgConfig.whatsapp_phone_number_id || !orgConfig.whatsapp_access_token || orgConfig.whatsapp_access_token === 'mock') {
    console.log(`[MOCK WHATSAPP TEMPLATE] To: ${to} | Template: ${templateName}`)
    return { messages: [{ id: `wamid.MOCK_${Date.now()}` }] }
  }

  // Build components array (header first, then body)
  const components: Array<Record<string, any>> = []

  if (headerType && headerMediaUrl && headerType !== 'none' && headerType !== 'text') {
    const mediaKey = headerType as 'image' | 'video' | 'document'
    components.push({
      type: 'header',
      parameters: [
        { type: mediaKey, [mediaKey]: { link: headerMediaUrl } }
      ],
    })
  }

  if (variables.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.map(v => ({ type: 'text', text: v })),
    })
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${orgConfig.whatsapp_phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConfig.whatsapp_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro na API do Meta')
  }
  return res.json()
}
