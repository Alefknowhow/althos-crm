/**
 * Provider-agnostic abstraction para o Althos Voice. O resto do módulo (Server
 * Actions, Inngest, webhook) fala só com esta interface — nunca importa o SDK
 * de um provider específico fora de lib/voice/providers/*.ts. A V1 usa Twilio
 * (TwilioVoiceProvider); trocar/adicionar provider (Telnyx, SIP/BYOC) implica
 * só escrever uma nova implementação desta interface, sem tocar no resto do
 * produto.
 */

export type CallDirection = 'inbound' | 'outbound'

export interface CreateCallInput {
  fromNumber: string
  toNumber: string
  /** URL de callback (TwiML/webhook) que o provider deve chamar ao conectar. */
  answerUrl: string
  statusCallbackUrl: string
  record: boolean
  recordingStatusCallbackUrl?: string
}

export interface ProviderCallResult {
  providerCallId: string
  status: string
}

export interface ProviderRecording {
  providerRecordingSid: string
  url: string
  durationSeconds: number | null
}

export interface ProviderUsageRecord {
  category: string
  costCents: number
  count: number
}

export interface AvailableNumber {
  e164Number: string
  friendlyName: string
  monthlyCostCents: number
  capabilities: { voice: boolean; sms: boolean }
}

export interface PurchasedNumber {
  providerNumberSid: string
  e164Number: string
}

export interface VoiceProvider {
  readonly name: string

  createCall(input: CreateCallInput): Promise<ProviderCallResult>
  answerCall(providerCallId: string): Promise<void>
  hangupCall(providerCallId: string): Promise<void>
  transferCall(providerCallId: string, toNumber: string): Promise<void>
  holdCall(providerCallId: string, hold: boolean): Promise<void>
  muteCall(providerCallId: string, mute: boolean): Promise<void>

  sendSMS(fromNumber: string, toNumber: string, body: string): Promise<{ providerMessageId: string }>

  listAvailableNumbers(areaCodeOrCountry: string): Promise<AvailableNumber[]>
  purchaseNumber(e164Number: string, voiceWebhookUrl: string, smsWebhookUrl?: string): Promise<PurchasedNumber>
  releaseNumber(providerNumberSid: string): Promise<void>

  getCall(providerCallId: string): Promise<ProviderCallResult & { durationSeconds: number | null }>
  getRecording(providerRecordingSid: string): Promise<ProviderRecording>
  getUsage(sinceIso: string): Promise<ProviderUsageRecord[]>

  /** Emite credenciais efêmeras para o Voice SDK do navegador (WebRTC). */
  createBrowserAccessToken(identity: string): Promise<{ token: string; ttlSeconds: number }>

  /** Reservado para Voice AI (Fase 3) — stream bidirecional de áudio da chamada. */
  streamAudio?(providerCallId: string, onAudioChunk: (chunk: Buffer) => void): Promise<{ stop: () => void }>
}
