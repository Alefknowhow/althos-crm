

/**
 * Multiplicador de consumo de crédito por modelo de IA. A Althos fornece e paga
 * o token; modelos mais caros consomem mais créditos por ação para manter o
 * custo por crédito ~constante. Baseado no PRICING de lib/ai/attendant-engine.ts.
 */
export const MODEL_CREDIT_MULTIPLIER: Record<string, number> = {
  'claude-haiku-4-5': 1,
  'gemini-1.5-flash': 1,
  'gemini-2.5-flash': 1,
  'gemini-2.5-flash-lite': 1,
  'gemini-3.6-flash': 2,
  'gemini-3.5-flash': 2,
  'gemini-3.5-flash-lite': 1,
  'deepseek-chat': 1,
  'claude-sonnet-4-6': 3,
  'gpt-4o': 3,
  'claude-opus-4-7': 5,
  'gpt-4.1': 5,
}


/** Modelos que o cliente pode escolher (rótulo + multiplicador). */
export const SELECTABLE_AI_MODELS: { id: string; label: string; multiplier: number }[] = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku (rápido, econômico)', multiplier: 1 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet (mais inteligente)', multiplier: 3 },
  { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', multiplier: 3 },
  { id: 'gemini-1.5-flash', label: 'Gemini Flash (Google)', multiplier: 1 },
  { id: 'deepseek-chat', label: 'DeepSeek', multiplier: 1 },
]


/** Resolve o multiplicador de um modelo, default 1×. */
export function modelCreditMultiplier(model: string | null | undefined): number {
  return MODEL_CREDIT_MULTIPLIER[model ?? ''] ?? 1
}


/** Preço de venda do crédito avulso (add-on), em centavos. */
export const ADDON_CREDIT_PRICE_CENTS = 15


/** Pacotes de créditos avulsos à venda (preço unitário decrescente). */
export const CREDIT_PACKS: { credits: number; priceCents: number }[] = [
  { credits: 100, priceCents: 1500 },   // R$0,15/cr
  { credits: 500, priceCents: 7000 },   // R$0,14/cr
  { credits: 1000, priceCents: 13000 }, // R$0,13/cr
]


/**
 * Cost (in AI credits) of each AI action. Mirrors the cost used by
 * `consume_ai_credits`. NOTE: DB credits are integer; fractional costs are
 * rounded UP at consume time (see consumeAiCredits in lib/plans/server.ts).
 */
export const AI_CREDIT_COST = {
  qualify_lead: 1,
  ai_attendant_reply: 1,
  instagram_ai_reply: 1,
  ai_insights_query: 2,
  lead_scoring: 1, // doc spec was 0.5 — rounded up to 1 because credits are integer
  generate_proposal: 3,
  // Leitura de imagem/PDF por visão (voucher, orçamento colado, etc.) — mais
  // cara que uma chamada de texto simples por causa do custo de visão do modelo.
  ocr_extract: 3,
  // Geração de roteiro com Gemini Flash 2.5 + busca na web — chamada mais
  // pesada que um OCR (grounding, prompt maior, saída longa).
  roteirista_generate: 4,
  // Chat de IA analítica do Financeiro — mesmo custo-base do copiloto da
  // Inicial (ai_insights_query), mantido separado pra métricas de uso e
  // gating de plano independentes.
  financial_ai_chat: 2,
} as const


export type AiAction = keyof typeof AI_CREDIT_COST
