import { useSettingsStore } from '../../stores/settings-store'

/**
 * Pentatonic Slendro note frequencies (Hz) for authentic traditional Indonesian timbre
 */
const SLENDRO_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25] // C4, D4, E4, G4, A4, C5

/**
 * Dynamic Procedural Ingame BGM backed by Web Audio API.
 * Combines traditional Indonesian Kendang rhythmic pulses with warm Bonang/Slendro
 * melodic arpeggios that adaptively respond to match threat levels (0 KB asset size).
 */
export class InGameBgmPlayer {
  private ctx: AudioContext | null = null
  private bgmGain: GainNode | null = null
  private isPlaying = false
  private isPaused = false

  private loopInterval: ReturnType<typeof setInterval> | null = null
  private currentStep = 0
  private threatLevel = 0 // 0.0 to 1.0

  private getEffectiveVolume(): number {
    try {
      const settings = useSettingsStore()
      return settings.effectiveBgmVolume
    } catch {
      return 0.45
    }
  }

  public init(existingCtx?: AudioContext): void {
    if (this.ctx) return

    try {
      if (existingCtx) {
        this.ctx = existingCtx
      } else {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioCtxClass) return
        this.ctx = new AudioCtxClass()
      }

      this.bgmGain = this.ctx.createGain()
      this.updateVolume()
      this.bgmGain.connect(this.ctx.destination)
    } catch {
      // AudioContext unavailable in headless test runner
    }
  }

  public updateVolume(): void {
    if (!this.bgmGain || !this.ctx) return
    const vol = this.getEffectiveVolume()
    this.bgmGain.gain.setValueAtTime(vol * 0.35, this.ctx.currentTime)
  }

  public start(existingCtx?: AudioContext): boolean {
    if (this.isPlaying && !this.isPaused) return true

    if (!this.ctx && existingCtx) {
      this.init(existingCtx)
    } else if (!this.ctx) {
      this.init()
    }

    if (!this.ctx || !this.bgmGain) return false

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }

    this.isPlaying = true
    this.isPaused = false
    this.currentStep = 0
    this.updateVolume()

    this.startSequencer()
    return true
  }

  public pause(): void {
    this.isPaused = true
    this.stopSequencer()
  }

  public resume(): void {
    if (!this.isPlaying) {
      this.start()
      return
    }
    this.isPaused = false
    this.startSequencer()
  }

  public stop(): void {
    this.isPlaying = false
    this.isPaused = false
    this.stopSequencer()
    this.currentStep = 0
  }

  public setThreatLevel(level: number): void {
    const clamped = Math.max(0, Math.min(1, level))
    if (Math.abs(this.threatLevel - clamped) > 0.05) {
      this.threatLevel = clamped
      // Adjust sequencing tempo dynamically based on threat level
      if (this.isPlaying && !this.isPaused) {
        this.startSequencer()
      }
    }
  }

  private getStepDurationMs(): number {
    // 96 BPM at threat 0 -> 132 BPM at threat 1
    const bpm = 96 + this.threatLevel * 36
    // 16th-note step interval
    return (60 / bpm / 4) * 1000
  }

  private startSequencer(): void {
    this.stopSequencer()
    const intervalMs = this.getStepDurationMs()

    this.loopInterval = setInterval(() => {
      this.tick()
    }, intervalMs)
  }

  private stopSequencer(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval)
      this.loopInterval = null
    }
  }

  private tick(): void {
    if (!this.ctx || !this.bgmGain || this.getEffectiveVolume() <= 0) return
    const step = this.currentStep % 16
    const t = this.ctx.currentTime

    // 1. Kendang Low Thud ("Dug") on beats 0, 8 (or 4, 12 when high threat)
    if (step === 0 || step === 8 || (this.threatLevel > 0.4 && (step === 4 || step === 12))) {
      this.triggerKendangDug(t)
    }

    // 2. Kendang Crisp Snap ("Tak") on offbeats 4, 10, 14
    if (step === 4 || step === 10 || (this.threatLevel > 0.6 && (step === 6 || step === 14))) {
      this.triggerKendangTak(t)
    }

    // 3. Melodic Slendro Note (Bonang chime pattern)
    // Plays patterned notes from pentatonic scale
    const melodySteps = [0, 3, 6, 8, 11, 14]
    if (melodySteps.includes(step)) {
      const noteIndex = (Math.floor(this.currentStep / 2) + (step % 3)) % SLENDRO_SCALE.length
      const freq = SLENDRO_SCALE[noteIndex] ?? 329.63
      this.triggerSlendroChime(t, freq)
    }

    this.currentStep++
  }

  /**
   * Kendang Low Thud: Resonant warm sine sweep 90Hz -> 48Hz
   */
  private triggerKendangDug(t: number): void {
    if (!this.ctx || !this.bgmGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(95, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)

    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)

    osc.connect(gain)
    gain.connect(this.bgmGain)

    osc.start(t)
    osc.stop(t + 0.15)
  }

  /**
   * Kendang Crisp Snap: Textured snappy transient 380Hz -> 180Hz
   */
  private triggerKendangTak(t: number): void {
    if (!this.ctx || !this.bgmGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(800, t)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(380, t)
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.05)

    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.bgmGain)

    osc.start(t)
    osc.stop(t + 0.07)
  }

  /**
   * Slendro Bonang Bell: Sine harmonic bell tone with metallic overtone
   */
  private triggerSlendroChime(t: number, freq: number): void {
    if (!this.ctx || !this.bgmGain) return
    const carrier = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    carrier.type = 'sine'
    carrier.frequency.setValueAtTime(freq, t)

    // Warm decay envelope
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.12 + this.threatLevel * 0.06, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)

    carrier.connect(gain)
    gain.connect(this.bgmGain)

    carrier.start(t)
    carrier.stop(t + 0.3)
  }

  public dispose(): void {
    this.stop()
    try {
      this.ctx?.close()
    } catch {
      // Ignore cleanup error
    }
    this.ctx = null
    this.bgmGain = null
  }
}

export const ingameBgm = new InGameBgmPlayer()
