/**
 * Tradução de texto curto (uma fala transcrita por vez) pra português —
 * chamada assistida (voice-assisted). Usa a Messages API da Anthropic
 * direto via fetch (sem o SDK completo, pra não engordar este serviço só
 * por isso) — mesma chave central usada no repo principal
 * (`ANTHROPIC_API_KEY`, ver lib/ai/api-key.ts::getPlatformAiKey()).
 */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

export async function translateToPortuguese(text: string, sourceLanguageHint: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return text
  if (!text.trim()) return text

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: `Traduza a fala a seguir (idioma de origem provável: ${sourceLanguageHint}) para português do Brasil, de forma direta e natural — sem comentários, sem aspas, só a tradução. Se já estiver em português, devolva o texto como está.`,
        messages: [{ role: 'user', content: text }],
      }),
    })
    if (!res.ok) {
      console.error('[translate] Anthropic respondeu', res.status)
      return text
    }
    const data = await res.json() as { content?: { type: string; text?: string }[] }
    const block = data.content?.find(c => c.type === 'text')
    return block?.text?.trim() || text
  } catch (err) {
    console.error('[translate] falha ao traduzir', err)
    return text
  }
}
