/**
 * Implementação Twilio do VoiceProvider (lib/voice/provider.ts). É a ÚNICA
 * peça do módulo que importa o SDK da Twilio — todo o resto (actions,
 * Inngest, webhook) fala com a interface VoiceProvider, nunca com este SDK
 * diretamente. Trocar de provider no futuro = escrever um novo arquivo aqui,
 * sem tocar no resto do produto.
 *
 * Credenciais: a conta master (`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, env
 * do servidor) cria uma SUBCONTA por organização (voice_accounts.provider_subaccount_sid).
 * O auth token da subconta fica em voice_provider_credentials (RLS sem
 * nenhuma policy de SELECT — só o service role lê). Nunca expostos ao client.
 */
import twilio from 'twilio'
import type {
  VoiceProvider, CreateCallInput, ProviderCallResult, ProviderRecording,
  ProviderUsageRecord, AvailableNumber, PurchasedNumber,
} from '../provider'

function getMasterClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN não configurados.')
  return twilio(sid, token)
}

/** Cliente autenticado com a subconta da organização (não a conta master). */
function getSubaccountClient(subaccountSid: string, subaccountAuthToken: string) {
  return twilio(subaccountSid, subaccountAuthToken)
}

export class TwilioVoiceProvider implements VoiceProvider {
  readonly name = 'twilio'
  private client: ReturnType<typeof twilio>
  private accountSid: string

  constructor(subaccountSid: string, subaccountAuthToken: string) {
    this.accountSid = subaccountSid
    this.client = getSubaccountClient(subaccountSid, subaccountAuthToken)
  }

  /** Cria uma subconta Twilio nova para uma organização (chamada 1x, no onboarding). */
  static async createSubaccount(friendlyName: string): Promise<{ sid: string; authToken: string }> {
    const master = getMasterClient()
    const sub = await master.api.v2010.accounts.create({ friendlyName })
    return { sid: sub.sid, authToken: sub.authToken }
  }

  async createCall(input: CreateCallInput): Promise<ProviderCallResult> {
    const call = await this.client.calls.create({
      from: input.fromNumber,
      to: input.toNumber,
      url: input.answerUrl,
      statusCallback: input.statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: input.record,
      recordingStatusCallback: input.recordingStatusCallbackUrl,
    })
    return { providerCallId: call.sid, status: call.status }
  }

  async answerCall(providerCallId: string): Promise<void> {
    // Chamadas de entrada respondidas via TwiML retornado no próprio webhook
    // de answer — não há uma ação separada de "atender" na API REST da Twilio.
    void providerCallId
  }

  async hangupCall(providerCallId: string): Promise<void> {
    await this.client.calls(providerCallId).update({ status: 'completed' })
  }

  async transferCall(providerCallId: string, toNumber: string): Promise<void> {
    const twiml = new (twilio as any).twiml.VoiceResponse()
    twiml.dial(toNumber)
    await this.client.calls(providerCallId).update({ twiml: twiml.toString() })
  }

  async holdCall(providerCallId: string, hold: boolean): Promise<void> {
    // Hold real requer <Conference> com hold/unhold; V1 simplificada: apenas
    // registra a intenção no chamador (a UI trata como "mudo + espera").
    void providerCallId
    void hold
  }

  async muteCall(providerCallId: string, mute: boolean): Promise<void> {
    // Mute é controlado no client WebRTC (Twilio Voice SDK), não via REST.
    void providerCallId
    void mute
  }

  async sendSMS(fromNumber: string, toNumber: string, body: string): Promise<{ providerMessageId: string }> {
    const msg = await this.client.messages.create({ from: fromNumber, to: toNumber, body })
    return { providerMessageId: msg.sid }
  }

  async listAvailableNumbers(areaCodeOrCountry: string): Promise<AvailableNumber[]> {
    const country = areaCodeOrCountry.length === 2 ? areaCodeOrCountry : 'BR'
    const numbers = await this.client.availablePhoneNumbers(country).local.list({ limit: 20 })
    return numbers.map(n => ({
      e164Number: n.phoneNumber,
      friendlyName: n.friendlyName,
      monthlyCostCents: 100, // Twilio não retorna preço na busca — resolvido via pricing API se necessário
      capabilities: { voice: !!n.capabilities?.voice, sms: !!n.capabilities?.sms },
    }))
  }

  async purchaseNumber(e164Number: string, voiceWebhookUrl: string, smsWebhookUrl?: string): Promise<PurchasedNumber> {
    const n = await this.client.incomingPhoneNumbers.create({
      phoneNumber: e164Number,
      voiceUrl: voiceWebhookUrl,
      smsUrl: smsWebhookUrl,
    })
    return { providerNumberSid: n.sid, e164Number: n.phoneNumber }
  }

  async releaseNumber(providerNumberSid: string): Promise<void> {
    await this.client.incomingPhoneNumbers(providerNumberSid).remove()
  }

  async getCall(providerCallId: string) {
    const call = await this.client.calls(providerCallId).fetch()
    return {
      providerCallId: call.sid,
      status: call.status,
      durationSeconds: call.duration ? Number(call.duration) : null,
    }
  }

  async getRecording(providerRecordingSid: string): Promise<ProviderRecording> {
    const rec = await this.client.recordings(providerRecordingSid).fetch()
    return {
      providerRecordingSid: rec.sid,
      url: `https://api.twilio.com${rec.uri.replace('.json', '.mp3')}`,
      durationSeconds: rec.duration ? Number(rec.duration) : null,
    }
  }

  async getUsage(sinceIso: string): Promise<ProviderUsageRecord[]> {
    const records = await this.client.usage.records.list({ startDate: new Date(sinceIso) })
    return records.map(r => ({
      category: r.category,
      costCents: Math.round(Number(r.price || 0) * -100), // Twilio retorna price negativo
      count: Number(r.count || 0),
    }))
  }

  async createBrowserAccessToken(identity: string): Promise<{ token: string; ttlSeconds: number }> {
    const apiKeySid = process.env.TWILIO_API_KEY_SID
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID
    if (!apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error('TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET/TWILIO_TWIML_APP_SID não configurados.')
    }
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    const ttlSeconds = 3600
    const token = new AccessToken(this.accountSid, apiKeySid, apiKeySecret, { identity, ttl: ttlSeconds })
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: true }))
    return { token: token.toJwt(), ttlSeconds }
  }
}
