import { useSettingsStore } from '../../stores/settings-store'

/**
 * Procedural Outdoor Ambient Wind Synthesizer (0 KB asset size).
 * Backed by Web Audio API pink noise filtering with dynamic breeze modulation
 * and natural wind gust swells across the arena.
 */
export class ArenaWindAudio {
  private ctx: AudioContext | null = null
  private dest: AudioNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private sourceNode: AudioBufferSourceNode | null = null
  private bandpassFilter: BiquadFilterNode | null = null
  private lowpassFilter: BiquadFilterNode | null = null
  private windGain: GainNode | null = null

  private isRunning = false
  private gustPhase = 0
  private baseVolume = 0.14

  private getEffectiveVolume(): number {
    try {
      const settings = useSettingsStore()
      return settings.effectiveSfxVolume
    } catch {
      return 0.8
    }
  }

  public init(ctx: AudioContext, dest: AudioNode, noiseBuffer: AudioBuffer): void {
    this.ctx = ctx
    this.dest = dest
    this.noiseBuffer = noiseBuffer
  }

  public start(): void {
    if (this.isRunning) return
    if (!this.ctx || !this.dest || !this.noiseBuffer) return
    if (typeof this.ctx.createBufferSource !== 'function') return

    try {
      const now = this.ctx.currentTime

      // 1. Looping noise source
      this.sourceNode = this.ctx.createBufferSource()
      this.sourceNode.buffer = this.noiseBuffer
      this.sourceNode.loop = true

      // 2. Dual-stage filters: Bandpass for wind resonance + Lowpass for soft warmth
      this.bandpassFilter = this.ctx.createBiquadFilter()
      this.bandpassFilter.type = 'bandpass'
      this.bandpassFilter.frequency.setValueAtTime(340, now)
      this.bandpassFilter.Q.setValueAtTime(1.3, now)

      this.lowpassFilter = this.ctx.createBiquadFilter()
      this.lowpassFilter.type = 'lowpass'
      this.lowpassFilter.frequency.setValueAtTime(700, now)

      // 3. Output Gain node
      this.windGain = this.ctx.createGain()
      const effectiveVol = this.getEffectiveVolume()
      const targetGain = effectiveVol > 0 ? this.baseVolume * effectiveVol : 0
      this.windGain.gain.setValueAtTime(0.001, now)
      this.windGain.gain.linearRampToValueAtTime(targetGain, now + 1.2)

      // Routing: Source -> Bandpass -> Lowpass -> Gain -> Destination
      this.sourceNode.connect(this.bandpassFilter)
      this.bandpassFilter.connect(this.lowpassFilter)
      this.lowpassFilter.connect(this.windGain)
      this.windGain.connect(this.dest)

      this.sourceNode.start(now)
      this.isRunning = true
    } catch {
      // In mock/test environments
      this.isRunning = false
    }
  }

  public stop(): void {
    if (!this.isRunning) return
    if (!this.ctx || !this.windGain) {
      this.cleanupNodes()
      this.isRunning = false
      return
    }

    try {
      const now = this.ctx.currentTime
      this.windGain.gain.linearRampToValueAtTime(0.001, now + 0.4)
      setTimeout(() => {
        this.cleanupNodes()
        this.isRunning = false
      }, 450)
    } catch {
      this.cleanupNodes()
      this.isRunning = false
    }
  }

  public update(dt: number, gustIntensity = 0.2): void {
    if (!this.isRunning || !this.ctx || !this.bandpassFilter || !this.windGain) return

    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.1, dt) : 0
    this.gustPhase += safeDt * 0.9

    const effectiveVol = this.getEffectiveVolume()
    if (effectiveVol <= 0) {
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime)
      return
    }

    // Natural undulating breeze (modulation between 260 Hz and 490 Hz)
    const swell = 0.5 + 0.5 * Math.sin(this.gustPhase)
    const normalizedGust = Math.max(0, Math.min(1, gustIntensity))
    const centerFreq = 260 + swell * 120 + normalizedGust * 110

    const t = this.ctx.currentTime
    this.bandpassFilter.frequency.setTargetAtTime(centerFreq, t, 0.15)

    // Dynamic amplitude swell
    const currentGain =
      (this.baseVolume * 0.7 + swell * this.baseVolume * 0.4 + normalizedGust * 0.08) * effectiveVol
    this.windGain.gain.setTargetAtTime(Math.min(0.35, currentGain), t, 0.18)
  }

  public updateVolume(volume: number): void {
    if (!this.ctx || !this.windGain) return
    const safeVol = Math.max(0, Math.min(1, volume))
    const t = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(this.baseVolume * safeVol, t, 0.1)
  }

  private cleanupNodes(): void {
    try {
      if (this.sourceNode) {
        this.sourceNode.stop()
        this.sourceNode.disconnect()
        this.sourceNode = null
      }
      if (this.bandpassFilter) {
        this.bandpassFilter.disconnect()
        this.bandpassFilter = null
      }
      if (this.lowpassFilter) {
        this.lowpassFilter.disconnect()
        this.lowpassFilter = null
      }
      if (this.windGain) {
        this.windGain.disconnect()
        this.windGain = null
      }
    } catch {
      // Ignore disconnect errors on destroyed nodes
    }
  }

  public dispose(): void {
    this.stop()
    this.cleanupNodes()
    this.ctx = null
    this.dest = null
    this.noiseBuffer = null
    this.isRunning = false
  }
}
