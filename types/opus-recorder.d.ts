declare module 'opus-recorder' {
  export default class Recorder {
    constructor(config?: Record<string, any>)
    ondataavailable: (arrayBuffer: ArrayBuffer) => void
    onstart?: () => void
    onstop?: () => void
    onpause?: () => void
    onresume?: () => void
    start(): Promise<void>
    stop(): void
    pause(flush?: boolean): void
    resume(): void
    close(): void
    static isRecordingSupported(): boolean
  }
}
