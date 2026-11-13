export class TensionLayer {
  private heartbeatTimer = 0
  private breathTimer = 0

  public update(
    dt: number,
    threatLevel: number,
    isExhausted: boolean,
    ctx: AudioContext | null,
    dest: AudioNode | null,
    noiseBuffer: AudioBuffer | null,
  ): void {
    if (!Number.isFinite(dt) || dt <= 0 || !ctx || !dest) return

    const safeThreat = Number.isFinite(threatLevel) ? Math.max(0, Math.min(1, threatLevel)) : 0

    // 1. Enemy-territory threat heartbeat (lub-dub cadence scales from 68 to 136 BPM)
    if (safeThreat > 0.08) {
      this.heartbeatTimer -= dt
      if (this.heartbeatTimer <= 0) {
        this.playHeartbeat(ctx, dest, safeThreat)
        const bpm = 68 + safeThreat * 68
        this.heartbeatTimer = 60 / bpm
      }
    } else {
      this.heartbeatTimer = 0
    }

    // 2. Exhaustion panting cadence
    if (isExhausted && noiseBuffer) {
      this.breathTimer -= dt
      if (this.breathTimer <= 0) {
        this.playBreathExhale(ctx, dest, noiseBuffer)
        this.breathTimer = 0.62
      }
    } else {
      this.breathTimer = 0
    }
  }

  public reset(): void {
    this.heartbeatTimer = 0
    this.breathTimer = 0
  }

  private playHeartbeat(ctx: AudioContext, dest: AudioNode, threatLevel: number): void {
    const now = ctx.currentTime
    const strength = 0.14 + threatLevel * 0.26

    this.triggerThump(ctx, dest, now, 62, strength)
    this.triggerThump(ctx, dest, now + 0.14, 52, strength * 0.72)
  }

  private triggerThump(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    freq: number,
    gainPeak: number,
  ): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * 1.4, startTime)
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.09)

    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14)

    osc.connect(gain)
    gain.connect(dest)
    osc.start(startTime)
    osc.stop(startTime + 0.15)
  }

  private playBreathExhale(
    ctx: AudioContext,
    dest: AudioNode,
    noiseBuffer: AudioBuffer,
  ): void {
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(920, now)
    filter.Q.value = 1.4

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.11, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    source.start(now)
    source.stop(now + 0.35)
  }
}

