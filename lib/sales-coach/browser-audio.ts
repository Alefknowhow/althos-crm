/**
 * Captura mic + áudio da aba da reunião (Meet/Zoom/Teams) e mixa num único
 * stream PCM16 16kHz, entregue em chunks via callback — para envio ao
 * serviço realtime (`services/sales-coach-realtime/`).
 *
 * Roda só no browser (client component). `getDisplayMedia` exige que o
 * vendedor escolha manualmente a aba/tela a compartilhar a cada sessão —
 * não há como pré-selecionar programaticamente (limitação de plataforma,
 * confirmada em pesquisa técnica, ver `.harness/tasks/active/ia-sales-coach.md`).
 * Usa `ScriptProcessorNode` (deprecado, mas universalmente suportado) por
 * simplicidade nesta fatia — migrar para `AudioWorklet` é candidato de
 * melhoria futura, não bloqueia o spike.
 */

export interface AudioCaptureHandle {
  stop(): void
}

export class AudioCaptureError extends Error {
  constructor(
    message: string,
    public readonly reason: 'mic_denied' | 'display_denied' | 'no_remote_audio' | 'unsupported',
  ) {
    super(message)
  }
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function startMixedAudioCapture(onChunk: (base64Pcm16: string) => void): Promise<AudioCaptureHandle> {
  if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
    throw new AudioCaptureError('Este navegador não suporta captura de áudio da aba/tela.', 'unsupported')
  }

  let micStream: MediaStream
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    throw new AudioCaptureError('Permissão de microfone negada.', 'mic_denied')
  }

  let displayStream: MediaStream
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  } catch {
    micStream.getTracks().forEach((t) => t.stop())
    throw new AudioCaptureError('Compartilhamento de aba/tela negado ou cancelado.', 'display_denied')
  }

  const remoteAudioTracks = displayStream.getAudioTracks()
  if (remoteAudioTracks.length === 0) {
    micStream.getTracks().forEach((t) => t.stop())
    displayStream.getTracks().forEach((t) => t.stop())
    throw new AudioCaptureError(
      'A aba/tela compartilhada não incluiu áudio. Ao compartilhar, marque a opção "Compartilhar áudio da aba".',
      'no_remote_audio',
    )
  }
  // Vídeo não é necessário — encerra a track de vídeo pra economizar recursos,
  // mantendo só as tracks de áudio da aba compartilhada.
  displayStream.getVideoTracks().forEach((t) => t.stop())

  const audioCtx = new AudioContext({ sampleRate: 16000 })
  const micSource = audioCtx.createMediaStreamSource(micStream)
  const remoteSource = audioCtx.createMediaStreamSource(new MediaStream(remoteAudioTracks))

  const micGain = audioCtx.createGain()
  const remoteGain = audioCtx.createGain()
  micSource.connect(micGain)
  remoteSource.connect(remoteGain)

  const processor = audioCtx.createScriptProcessor(4096, 1, 1)
  micGain.connect(processor)
  remoteGain.connect(processor)

  // ScriptProcessorNode só dispara `onaudioprocess` se estiver conectado ao
  // grafo até o destino — conecta via um gain mudo pra não reproduzir o
  // áudio mixado de volta pro vendedor (eco).
  const muteGain = audioCtx.createGain()
  muteGain.gain.value = 0
  processor.connect(muteGain)
  muteGain.connect(audioCtx.destination)

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    const pcm16 = float32ToInt16(input)
    onChunk(int16ToBase64(pcm16))
  }

  return {
    stop() {
      processor.onaudioprocess = null
      processor.disconnect()
      muteGain.disconnect()
      micGain.disconnect()
      remoteGain.disconnect()
      micSource.disconnect()
      remoteSource.disconnect()
      micStream.getTracks().forEach((t) => t.stop())
      displayStream.getTracks().forEach((t) => t.stop())
      void audioCtx.close()
    },
  }
}
