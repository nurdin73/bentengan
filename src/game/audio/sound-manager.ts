import { useSettingsStore } from '../../stores/settings-store'
import { computeSpatialMix, type SpatialPoint } from './audio-spatial.utils'
import { ingameBgm } from './ingame-bgm'
import {
  triggerAdrenalineSfx,
  triggerCaughtStingSfx,
  triggerDashSfx,
  triggerSkillDeniedSfx,
  triggerSmokeSfx,
} from './skill-sfx'
import { TensionLayer } from './tension-layer'
import { uiSound } from './ui-sound'

export class SoundManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private listenerPos: SpatialPoint | null = null
  private listenerYaw = 0
  private readonly tensionLayer = new TensionLayer()

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

      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        this.compressor = this.ctx.createDynamicsCompressor()
        this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime)
        this.compressor.knee.setValueAtTime(18, this.ctx.currentTime)
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime)
        this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime)
        this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime)
        this.masterGain.connect(this.compressor)
        this.compressor.connect(this.ctx.destination)
      } else {
        this.masterGain.connect(this.ctx.destination)
      }

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

  public setListener(pos: SpatialPoint, yawRad: number): void {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return
    this.listenerPos = pos
    this.listenerYaw = Number.isFinite(yawRad) ? yawRad : 0
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

  private routeOutput(origin?: SpatialPoint): AudioNode | null {
    if (!this.ctx || !this.masterGain) return null
    if (!origin || !this.listenerPos) return this.masterGain

    const mix = computeSpatialMix(this.listenerPos, this.listenerYaw, origin)
    if (mix.gain <= 0.01) return null

    if (mix.gain > 0.98 && Math.abs(mix.pan) < 0.03) {
      return this.masterGain
    }

    const spatialGain = this.ctx.createGain()
    spatialGain.gain.setValueAtTime(mix.gain, this.ctx.currentTime)

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner()
      panner.pan.setValueAtTime(mix.pan, this.ctx.currentTime)
      spatialGain.connect(panner)
      panner.connect(this.masterGain)
    } else {
      spatialGain.connect(this.masterGain)
    }

    return spatialGain
  }

  /**
   * Footstep: Ground patter on turf/dirt with body resonance + textured transient.
   * Distinct characteristics for walking vs sprinting.
   */
  public playFootstep(isSprinting = false): void {
    const now = performance.now()
    const minInterval = isSprinting ? 140 : 220
    if (now - this.lastFootstepTime < minInterval) return
    this.lastFootstepTime = now

    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const pitchJitter = 1 + (Math.random() * 0.12 - 0.06)

    // 1. Resonant Body Thud
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    const oscFilter = this.ctx.createBiquadFilter()

    oscFilter.type = 'lowpass'
    oscFilter.frequency.setValueAtTime(isSprinting ? 320 : 220, t)

    const startFreq = (isSprinting ? 260 : 180) * pitchJitter
    const endFreq = (isSprinting ? 110 : 90) * pitchJitter
    const thudDuration = isSprinting ? 0.065 : 0.05

    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, t)
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + thudDuration)

    const baseVolume = isSprinting ? 0.28 : 0.18
    oscGain.gain.setValueAtTime(baseVolume, t)
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + thudDuration)

    osc.connect(oscFilter)
    oscFilter.connect(oscGain)
    oscGain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + thudDuration + 0.005)

    // 2. Light Grass / Dirt Texture Puff (using noiseBuffer if available)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource()
      noise.buffer = this.noiseBuffer

      const noiseFilter = this.ctx.createBiquadFilter()
      noiseFilter.type = 'bandpass'
      noiseFilter.Q.setValueAtTime(1.2, t)

      const noiseFreq = isSprinting ? 1600 : 900
      noiseFilter.frequency.setValueAtTime(noiseFreq * pitchJitter, t)
      noiseFilter.frequency.exponentialRampToValueAtTime(
        (isSprinting ? 600 : 400) * pitchJitter,
        t + thudDuration,
      )

      const noiseGain = this.ctx.createGain()
      noiseGain.gain.setValueAtTime(baseVolume * 0.45, t)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + thudDuration)

      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.masterGain)

      noise.start(t)
      noise.stop(t + thudDuration + 0.005)
    }
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
    gain.gain.linearRampToValueAtTime(0.14, t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noise.start(t)
    noise.stop(t + 0.23)
  }

  /**
   * Jump: Playful cartoon bubble-spring pop (Warm sine glide 180Hz -> 420Hz).
   */
  public playJump(origin?: SpatialPoint): void {
    if (!this.ensureReady() || !this.ctx) return
    const dest = this.routeOutput(origin)
    if (!dest) return

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
    gain.gain.linearRampToValueAtTime(0.24, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)

    osc.start(t)
    osc.stop(t + 0.11)
  }

  /**
   * Land: Cushioned ground thump (Low sine drop 75Hz -> 32Hz, muffled).
   */
  public playLand(origin?: SpatialPoint): void {
    if (!this.ensureReady() || !this.ctx) return
    const dest = this.routeOutput(origin)
    if (!dest) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(150, t)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(75, t)
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.065)

    gain.gain.setValueAtTime(0.18, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)

    osc.start(t)
    osc.stop(t + 0.08)
  }

  /**
   * Stun: Whimsical cartoon dizzy celesta chimes (Soft cycling bells D5 <-> F#5 <-> A5).
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
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015)
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
   */
  public playCapture(origin?: SpatialPoint): void {
    if (!this.ensureReady() || !this.ctx) return
    const dest = this.routeOutput(origin)
    if (!dest) return

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

    bodyGain.gain.setValueAtTime(0.4, t)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055)

    bodyOsc.connect(filter)
    filter.connect(bodyGain)
    bodyGain.connect(dest)

    bodyOsc.start(t)
    bodyOsc.stop(t + 0.06)

    // 2. Harmonic top transient tap (Sine 960Hz -> 520Hz)
    const tapOsc = this.ctx.createOscillator()
    const tapGain = this.ctx.createGain()

    tapOsc.type = 'sine'
    tapOsc.frequency.setValueAtTime(960, t)
    tapOsc.frequency.exponentialRampToValueAtTime(520, t + 0.02)

    tapGain.gain.setValueAtTime(0.25, t)
    tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028)

    tapOsc.connect(tapGain)
    tapGain.connect(dest)

    tapOsc.start(t)
    tapOsc.stop(t + 0.03)
  }

  /**
   * Rescue: Indonesian Gamelan Bonang / Saron Arpeggio (Pelog Pentatonic Laras).
   */
  public playRescue(origin?: SpatialPoint): void {
    if (!this.ensureReady() || !this.ctx) return
    const dest = this.routeOutput(origin)
    if (!dest) return

    const t = this.ctx.currentTime
    const gamelanTones = [560, 672, 840]
    const step = 0.06

    gamelanTones.forEach((baseFreq, idx) => {
      if (!this.ctx) return
      const startT = t + idx * step

      const carrier = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      carrier.type = 'sine'
      carrier.frequency.setValueAtTime(baseFreq, startT)

      const overtone = this.ctx.createOscillator()
      const overGain = this.ctx.createGain()
      overtone.type = 'sine'
      overtone.frequency.setValueAtTime(baseFreq * 2.76, startT)

      gain.gain.setValueAtTime(0.001, startT)
      gain.gain.linearRampToValueAtTime(0.28, startT + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.45)

      overGain.gain.setValueAtTime(0.001, startT)
      overGain.gain.linearRampToValueAtTime(0.12, startT + 0.006)
      overGain.gain.exponentialRampToValueAtTime(0.001, startT + 0.18)

      carrier.connect(gain)
      overtone.connect(overGain)
      gain.connect(dest)
      overGain.connect(dest)

      carrier.start(startT)
      overtone.start(startT)
      carrier.stop(startT + 0.48)
      overtone.stop(startT + 0.2)
    })
  }

  /**
   * Base Touch: Deep Indonesian Gong Ageng (65Hz sub-bass, 130Hz harmonic, 2.2s warm reverb).
   */
  public playBaseTouch(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime

    const gongSub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    gongSub.type = 'sine'
    gongSub.frequency.setValueAtTime(65, t)

    subGain.gain.setValueAtTime(0.001, t)
    subGain.gain.linearRampToValueAtTime(0.42, t + 0.035)
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.2)

    gongSub.connect(subGain)
    subGain.connect(this.masterGain)
    gongSub.start(t)
    gongSub.stop(t + 2.3)

    const gongHarmonic = this.ctx.createOscillator()
    const harmGain = this.ctx.createGain()
    gongHarmonic.type = 'sine'
    gongHarmonic.frequency.setValueAtTime(130, t)

    harmGain.gain.setValueAtTime(0.001, t)
    harmGain.gain.linearRampToValueAtTime(0.24, t + 0.02)
    harmGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5)

    gongHarmonic.connect(harmGain)
    harmGain.connect(this.masterGain)
    gongHarmonic.start(t)
    gongHarmonic.stop(t + 1.6)
  }

  public playDash(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return
    triggerDashSfx(this.ctx, this.masterGain, this.noiseBuffer)
  }

  public playSmoke(origin?: SpatialPoint): void {
    if (!this.ensureReady() || !this.ctx) return
    const dest = this.routeOutput(origin)
    if (!dest) return
    triggerSmokeSfx(this.ctx, dest, this.noiseBuffer)
  }

  public playAdrenaline(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return
    triggerAdrenalineSfx(this.ctx, this.masterGain)
  }

  public playSkillDenied(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return
    triggerSkillDeniedSfx(this.ctx, this.masterGain)
  }

  public playCaughtSting(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return
    triggerCaughtStingSfx(this.ctx, this.masterGain)
  }

  public playWhistleStart(): void {
    uiSound.playWhistleStart()
  }

  /**
   * Heavy panting breath / gasp when player runs out of stamina.
   */
  public playExhaustionGasp(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain || !this.noiseBuffer) return

    const t = this.ctx.currentTime
    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noiseBuffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(450, t)
    filter.Q.setValueAtTime(1.5, t)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.2, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noise.start(t)
    noise.stop(t + 0.36)
  }

  /**
   * Subtle alert buzzer when approaching out-of-bounds boundary.
   */
  public playBoundaryWarning(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(220, t)

    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.08, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.11)
  }

  public startIngameBgm(): void {
    if (!this.ensureReady() || !this.ctx) return
    ingameBgm.start(this.ctx)
  }

  public stopIngameBgm(): void {
    ingameBgm.stop()
  }

  public updateTension(dt: number, threatLevel: number, isExhausted: boolean): void {
    if (!this.ctx || !this.masterGain || this.getEffectiveVolume() <= 0) return
    if (this.ctx.state === 'suspended') return
    ingameBgm.setThreatLevel(threatLevel)
    this.tensionLayer.update(
      dt,
      threatLevel,
      isExhausted,
      this.ctx,
      this.masterGain,
      this.noiseBuffer,
    )
  }

  public resetTension(): void {
    this.tensionLayer.reset()
    ingameBgm.setThreatLevel(0)
  }

  /**
   * Victory: Joyful Gamelan & Triumphant Fanfare (Pentatonic C5 -> E5 -> G5 -> C6).
   */
  public playVictory(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return

    const t = this.ctx.currentTime
    const melody = [
      { f: 523.25, t: 0.0, d: 0.12 },
      { f: 659.25, t: 0.11, d: 0.12 },
      { f: 783.99, t: 0.22, d: 0.16 },
      { f: 1046.5, t: 0.36, d: 1.4 },
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
      gain.gain.linearRampToValueAtTime(0.32, startT + 0.015)
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
      gain.gain.linearRampToValueAtTime(0.2, startT + 0.02)
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
    this.resetTension()
    this.stopIngameBgm()
    try {
      this.ctx?.close()
    } catch {
      // Ignore cleanup error
    }
    this.ctx = null
    this.masterGain = null
    this.compressor = null
    this.noiseBuffer = null
    this.listenerPos = null
  }
}

// Global singleton instance for easy import across game systems
export const soundManager = new SoundManager()
