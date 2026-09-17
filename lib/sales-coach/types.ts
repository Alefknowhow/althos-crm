/**
 * Tipos compartilhados do Sales Context Engine / Sales Event Engine.
 * Espelha a estrutura conceitual descrita no pedido original (§12) —
 * mantido como TS puro (sem I/O) pra ser fácil de testar e serializar em
 * `sales_coach_context.data` (jsonb).
 */

export interface TranscriptSegmentInput {
  speaker?: string
  text: string
}

export interface SalesContext {
  pains: string[]
  needs: string[]
  goals: string[]
  budget: string | null
  authority: string[]
  decisionMakers: string[]
  competitors: string[]
  objections: string[]
  buyingSignals: string[]
  productsInterested: string[]
  commitments: string[]
  risks: string[]
  questionsAnswered: string[]
  questionsPending: string[]
  nextSteps: string[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  currentSalesStage: string | null
  recommendedObjective: string | null
}

export function emptySalesContext(): SalesContext {
  return {
    pains: [],
    needs: [],
    goals: [],
    budget: null,
    authority: [],
    decisionMakers: [],
    competitors: [],
    objections: [],
    buyingSignals: [],
    productsInterested: [],
    commitments: [],
    risks: [],
    questionsAnswered: [],
    questionsPending: [],
    nextSteps: [],
    sentiment: null,
    currentSalesStage: null,
    recommendedObjective: null,
  }
}

export type SalesEventType =
  | 'PAIN_DETECTED'
  | 'NEED_DETECTED'
  | 'GOAL_DETECTED'
  | 'OBJECTION_DETECTED'
  | 'BUYING_SIGNAL'
  | 'COMPETITOR_MENTIONED'
  | 'BUDGET_DETECTED'
  | 'AUTHORITY_DETECTED'
  | 'DECISION_MAKER_DETECTED'
  | 'PRICING_QUESTION'
  | 'RISK_DETECTED'
  | 'COMMITMENT_DETECTED'
  | 'NEXT_STEP_DETECTED'
  | 'QUESTION_RECOMMENDED'
  | 'ANSWER_RECOMMENDED'
  | 'NEXT_BEST_ACTION'

export interface SalesEvent {
  type: SalesEventType
  /** Texto curto do que foi detectado (não o transcript inteiro). */
  summary: string
  /** 0-1 — confiança do modelo na detecção. */
  confidence: number
  /** 0-1 — o quão relevante é pra UI decidir se mostra ou não (spec §3: não bombardear). */
  importance: number
  /** Sugestão acionável ao vendedor, quando aplicável (ex.: pergunta a fazer). */
  suggestion: string | null
}
