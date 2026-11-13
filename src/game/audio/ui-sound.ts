import { useSettingsStore } from '../../stores/settings-store'

/**
 * Procedural Web Audio API sound generator for UI interactions across
 * Homepage, Lobby, and Menus (zero external asset payload).
 */
export class UiSoundManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  private getEffectiveVolume(): number {
    try {
      const settings = useSettingsStore()
      return settings.effectiveSfxVolume
    } catch {
      return 0.8
    }
  }

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

      if (!AudioCtxClass) return

      this.ctx = new AudioCtxClass()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
      this.updateVolume()
    } catch {
      // AudioContext unavailable in headless test runners
    }
  }

  private updateVolume(): void {
    if (!this.masterGain || !this.ctx) return
    const vol = this.getEffectiveVolume()
    this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime)
  }

  private ensureReady(): boolean {
    if (!this.ctx) {
      this.init()
    }
    if (!this.ctx || !this.masterGain) return false
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    this.updateVolume()
    return this.getEffectiveVolume() > 0
  }

  /**
   * Crisp tactile click / tap for buttons and interactive controls.
   */
  public playUiClick(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1400, t)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(750, t)
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.035)

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.2, t + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.045)
  }

  /**
   * Cheerful two-tone chord chime when toggling Ready state in Lobby.
   */
  public playUiToggleReady(isReady: boolean): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const baseFreq = isReady ? 523.25 : 440 // C5 or A4
    const secondFreq = isReady ? 659.25 : 349.23 // E5 or F4

    const notes = [
      { f: baseFreq, offset: 0, d: 0.12 },
      { f: secondFreq, offset: 0.06, d: 0.16 },
    ]

    notes.forEach((note) => {
      if (!this.ctx || !this.masterGain) return
      const startT = t + note.offset
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.f, startT)

      gain.gain.setValueAtTime(0.001, startT)
      gain.gain.linearRampToValueAtTime(0.22, startT + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + note.d)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(startT)
      osc.stop(startT + note.d + 0.01)
    })
  }

  /**
   * Stereo pitch slide when switching between Red and Blue teams.
   */
  public playUiTeamSwitch(team: 'blue' | 'red'): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    const startFreq = team === 'blue' ? 320 : 480
    const endFreq = team === 'blue' ? 480 : 320

    osc.frequency.setValueAtTime(startFreq, t)
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.09)

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.1)
  }

  /**
   * High-pitch pleasant chime for successful copy of room code.
   */
  public playUiCopyCode(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t) // A5

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.19)
  }

  /**
   * Woodblock acoustic tap for countdown timer (3, 2, 1).
   */
  public playCountdownTick(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1200, t)
    filter.Q.setValueAtTime(4.0, t)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04)

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.055)
  }

  /**
   * Two-tone referee whistle trill marking match start / "MULAI!".
   */
  public playWhistleStart(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    // Whistle is typically two harmonically close high sine frequencies creating acoustic beating
    const f1 = 2450
    const f2 = 2750

    const duration = 0.35

    ;[f1, f2].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      // Slight pitch wobble
      osc.frequency.linearRampToValueAtTime(freq + 40, t + 0.15)
      osc.frequency.linearRampToValueAtTime(freq, t + duration)

      gain.gain.setValueAtTime(0.001, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.setValueAtTime(0.2, t + duration - 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(t)
      osc.stop(t + duration + 0.01)
    })
  }

  public dispose(): void {
    try {
      this.ctx?.close()
    } catch {
      // Ignore cleanup error
    }
    this.ctx = null
    this.masterGain = null
  }
}

export const uiSound = new UiSoundManager()
