import { useSettingsStore } from '../../stores/settings-store'

export class SoundManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  // Active interval/nodes for whimsical cartoon stun chimes
  private stunInterval: ReturnType<typeof setInterval> | null = null
  private isStunActive = false

  // Throttling to prevent audio overload
  private lastFootstepTime = 0
  private lastWhooshTime = 0

  constructor() {
    // Lazy initialization handled on first user interaction
  }

  /**
   * Initializes AudioContext safely on user gesture or game start
   */
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
      this.updateMasterVolume()

      // Generate 1-second filtered soft noise buffer for organic air breeze & impacts
      const bufferSize = this.ctx.sampleRate
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const output = this.noiseBuffer.getChannelData(0)
      let b0 = 0
      let b1 = 0
      let b2 = 0
      // Gentle pink-ish noise generation (smoother than harsh white noise)
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99765 * b0 + white * 0.099046
        b1 = 0.963 * b1 + white * 0.2965164
        b2 = 0.57 * b2 + white * 1.0526913
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08
      }
    } catch {
      // AudioContext unavailable in headless/mock test runner
    }
  }

  private getEffectiveVolume(): number {
    try {
      const settings = useSettingsStore()
      return settings.effectiveSfxVolume
    } catch {
      return 0.8
    }
  }

  private updateMasterVolume(): void {
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
    this.updateMasterVolume()
    return this.getEffectiveVolume() > 0
  }

  /**
   * Footstep: Subtle, muffled ground patter (Low-pass 160Hz, soft gain).
   * Designed to be pleasant and unobtrusive over long gameplay sessions.
   */
  public playFootstep(): void {
    const now = performance.now()
    if (now - this.lastFootstepTime < 190) return
    this.lastFootstepTime = now

    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(160, t)

    const pitchJitter = 1 + (Math.random() * 0.1 - 0.05)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(95 * pitchJitter, t)
    osc.frequency.exponentialRampToValueAtTime(38 * pitchJitter, t + 0.038)

    // Soft volume level to avoid ear fatigue
    gain.gain.setValueAtTime(0.09 * this.getEffectiveVolume(), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.045)
  }

  /**
   * Sprint Whoosh: Soft airy breeze (Gentle band-pass pink noise sweep 400Hz -> 850Hz)
   */
  public playSprintWhoosh(): void {
    const now = performance.now()
    if (now - this.lastWhooshTime < 650) return
    this.lastWhooshTime = now

    if (!this.ensureReady() || !this.ctx || !this.masterGain || !this.noiseBuffer) return

    const t = this.ctx.currentTime
    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noiseBuffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.setValueAtTime(1.8, t)
    filter.frequency.setValueAtTime(420, t)
    filter.frequency.exponentialRampToValueAtTime(850, t + 0.2)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.12 * this.getEffectiveVolume(), t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noise.start(t)
    noise.stop(t + 0.23)
  }

  /**
   * Jump: Playful cartoon bubble-spring pop (Warm sine glide 180Hz -> 420Hz).
   * Warm, soft, and satisfying.
   */
  public playJump(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(900, t)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.09)

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.24 * this.getEffectiveVolume(), t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.11)
  }

  /**
   * Land: Cushioned ground thump (Low sine drop 75Hz -> 32Hz, muffled).
   */
  public playLand(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(150, t)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(75, t)
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.065)

    gain.gain.setValueAtTime(0.18 * this.getEffectiveVolume(), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.08)
  }

  /**
   * Stun: Whimsical cartoon dizzy celesta chimes (Soft cycling bells D5 <-> F#5 <-> A5).
   * Replaces the harsh continuous buzz with a charming, humorous cartoon wobble.
   */
  public startStun(): void {
    if (this.isStunActive) return
    this.isStunActive = true

    if (!this.ensureReady() || !this.ctx) return

    const notes = [587.33, 739.99, 880.0, 739.99] // D5, F#5, A5, F#5
    let noteIdx = 0

    const playChime = () => {
      if (!this.isStunActive || !this.ctx || !this.masterGain) return
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      const freq = notes[noteIdx % notes.length] ?? 587.33
      osc.frequency.setValueAtTime(freq, t)
      noteIdx++

      gain.gain.setValueAtTime(0.001, t)
      gain.gain.linearRampToValueAtTime(0.14 * this.getEffectiveVolume(), t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(t)
      osc.stop(t + 0.24)
    }

    playChime()
    this.stunInterval = setInterval(playChime, 240)
  }

  public stopStun(): void {
    if (!this.isStunActive) return
    this.isStunActive = false
    if (this.stunInterval) {
      clearInterval(this.stunInterval)
      this.stunInterval = null
    }
  }

  /**
   * Capture: Tactile Bamboo / Wooden Pop ("Btok!").
   * Dual-harmonic wooden body cavity resonance (480Hz -> 240Hz), juicy and satisfying!
   */
  public playCapture(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime

    // 1. Fundamental hollow body (Sine 480Hz -> 240Hz)
    const bodyOsc = this.ctx.createOscillator()
    const bodyGain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1400, t)
    filter.Q.setValueAtTime(2.2, t)

    bodyOsc.type = 'sine'
    bodyOsc.frequency.setValueAtTime(480, t)
    bodyOsc.frequency.exponentialRampToValueAtTime(240, t + 0.04)

    bodyGain.gain.setValueAtTime(0.4 * this.getEffectiveVolume(), t)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055)

    bodyOsc.connect(filter)
    filter.connect(bodyGain)
    bodyGain.connect(this.masterGain)

    bodyOsc.start(t)
    bodyOsc.stop(t + 0.06)

    // 2. Harmonic top transient tap (Sine 960Hz -> 520Hz)
    const tapOsc = this.ctx.createOscillator()
    const tapGain = this.ctx.createGain()

    tapOsc.type = 'sine'
    tapOsc.frequency.setValueAtTime(960, t)
    tapOsc.frequency.exponentialRampToValueAtTime(520, t + 0.02)

    tapGain.gain.setValueAtTime(0.25 * this.getEffectiveVolume(), t)
    tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028)

    tapOsc.connect(tapGain)
    tapGain.connect(this.masterGain)

    tapOsc.start(t)
    tapOsc.stop(t + 0.03)
  }

  /**
   * Rescue: Indonesian Gamelan Bonang / Saron Arpeggio (Pelog Pentatonic Laras).
   * Warm bronze metallic bell resonance, uplifting and deeply rewarding.
   */
  public playRescue(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    // Gamelan Pelog scale frequencies: Nem (560Hz) -> Barang (672Hz) -> Manyura (840Hz)
    const gamelanTones = [560, 672, 840]
    const step = 0.06

    gamelanTones.forEach((baseFreq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const startT = t + idx * step

      // Primary tone
      const carrier = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      carrier.type = 'sine'
      carrier.frequency.setValueAtTime(baseFreq, startT)

      // Gamelan bronze harmonic overtone (2.76x ratio characteristic of struck bronze slabs)
      const overtone = this.ctx.createOscillator()
      const overGain = this.ctx.createGain()
      overtone.type = 'sine'
      overtone.frequency.setValueAtTime(baseFreq * 2.76, startT)

      // Primary gain envelope
      gain.gain.setValueAtTime(0.001, startT)
      gain.gain.linearRampToValueAtTime(0.28 * this.getEffectiveVolume(), startT + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.45)

      // Metallic shimmer gain envelope (faster decay)
      overGain.gain.setValueAtTime(0.001, startT)
      overGain.gain.linearRampToValueAtTime(0.12 * this.getEffectiveVolume(), startT + 0.006)
      overGain.gain.exponentialRampToValueAtTime(0.001, startT + 0.18)

      carrier.connect(gain)
      overtone.connect(overGain)
      gain.connect(this.masterGain)
      overGain.connect(this.masterGain)

      carrier.start(startT)
      overtone.start(startT)
      carrier.stop(startT + 0.48)
      overtone.stop(startT + 0.2)
    })
  }

  /**
   * Base Touch: Deep Indonesian Gong Ageng (65Hz sub-bass, 130Hz harmonic, 2.2s warm reverb).
   * Majestic, resonant, and solemn fortress conquest announcement.
   */
  public playBaseTouch(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime

    // 1. Gong Fundamental (Deep 65Hz C2)
    const gongSub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    gongSub.type = 'sine'
    gongSub.frequency.setValueAtTime(65, t)

    subGain.gain.setValueAtTime(0.001, t)
    subGain.gain.linearRampToValueAtTime(0.42 * this.getEffectiveVolume(), t + 0.035)
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.2)

    gongSub.connect(subGain)
    subGain.connect(this.masterGain)
    gongSub.start(t)
    gongSub.stop(t + 2.3)

    // 2. Gong Body Overtone (130Hz & 195Hz warmth)
    const gongHarmonic = this.ctx.createOscillator()
    const harmGain = this.ctx.createGain()
    gongHarmonic.type = 'sine'
    gongHarmonic.frequency.setValueAtTime(130, t)

    harmGain.gain.setValueAtTime(0.001, t)
    harmGain.gain.linearRampToValueAtTime(0.24 * this.getEffectiveVolume(), t + 0.02)
    harmGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5)

    gongHarmonic.connect(harmGain)
    harmGain.connect(this.masterGain)
    gongHarmonic.start(t)
    gongHarmonic.stop(t + 1.6)
  }

  /**
   * Victory: Joyful Gamelan & Triumphant Fanfare (Pentatonic C5 -> E5 -> G5 -> C6).
   * Bright, festive, and celebration-worthy.
   */
  public playVictory(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const melody = [
      { f: 523.25, t: 0.0, d: 0.12 },
      { f: 659.25, t: 0.11, d: 0.12 },
      { f: 783.99, t: 0.22, d: 0.16 },
      { f: 1046.5, t: 0.36, d: 1.4 }, // High triumphant tone
    ]

    melody.forEach((note) => {
      if (!this.ctx || !this.masterGain) return
      const startT = t + note.t
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(2200, startT)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.f, startT)

      gain.gain.setValueAtTime(0.001, startT)
      gain.gain.linearRampToValueAtTime(0.32 * this.getEffectiveVolume(), startT + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + note.d)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(startT)
      osc.stop(startT + note.d + 0.02)
    })
  }

  /**
   * Defeat: Gentle Mellow Slide (Soft descending tones 440Hz -> 370Hz -> 293Hz).
   * Respectful and gentle, avoiding harsh dissonant screeching.
   */
  public playDefeat(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const notes = [
      { f: 440.0, t: 0.0, d: 0.22 },
      { f: 369.99, t: 0.2, d: 0.25 },
      { f: 293.66, t: 0.42, d: 0.8 },
    ]

    notes.forEach((note) => {
      if (!this.ctx || !this.masterGain) return
      const startT = t + note.t
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(600, startT)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(note.f, startT)

      gain.gain.setValueAtTime(0.001, startT)
      gain.gain.linearRampToValueAtTime(0.2 * this.getEffectiveVolume(), startT + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + note.d)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(startT)
      osc.stop(startT + note.d + 0.02)
    })
  }

  public dispose(): void {
    this.stopStun()
    try {
      this.ctx?.close()
    } catch {
      // Ignore cleanup error
    }
    this.ctx = null
    this.masterGain = null
    this.noiseBuffer = null
  }
}

// Global singleton instance for easy import across game systems
export const soundManager = new SoundManager()
