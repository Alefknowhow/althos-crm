/**
 * Extração de dados de documentos de viagem (voucher de operadora, print de
 * reserva, orçamento completo, etc.) via visão do Claude/Gemini — sem lib de
 * OCR separada -- barrel. Split across:
 *   - document-extract-types.ts: ExtractedTravelDocument, TRAVELERS_PROMPT_HINT
 *   - document-extract-claude.ts: extractTravelDocumentFromFile (Claude, tool_choice)
 *   - document-extract-gemini.ts: extractTravelDocumentFromFileGemini (Gemini Flash)
 *   - document-extract-normalize.ts: normalizeExtractedDocument (shared)
 *
 * Cobre todos os tipos de produto do Construtor de Viagens (hospedagem,
 * aéreo, cruzeiro, transfer, seguro, passeio, locação de veículo) — o botão
 * "Autopreencher com IA" do editor de cotações lê um documento (orçamento
 * de fornecedor, voucher, etc.) e preenche todos os produtos identificados,
 * não só hotel/voo como na versão anterior.
 */

export * from './document-extract-types'
export * from './document-extract-claude'
export * from './document-extract-gemini'
export * from './document-extract-normalize'
