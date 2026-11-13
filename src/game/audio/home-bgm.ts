const STEP_DURATION_SEC = 0.326 // ~92 BPM eighth-note grid
const LOOKAHEAD_MS = 90
const SCHEDULE_AHEAD_SEC = 0.22
const TOTAL_STEPS = 32 // 4-bar phrase (8 steps per bar)
const MAX_MASTER_GAIN = 0.38

// Warm Indonesian Slendro/Pelog-inspired C Major Pentatonic melody (Hz, 0 = rest)
const MELODY_PATTERN: readonly number[] = [
  523.25, 0, 587.33, 659.25, 783.99, 0, 659.25, 587.33,
  523.25, 0, 440.0, 523.25, 587.33, 0, 0, 0,
  659.25, 0, 783.99, 880.0, 783.99, 0, 659.25, 587.33,
  659.25, 0, 587.33, 523.25, 440.0, 0, 392.0, 0,
]

// Gentle harmonic accompaniment notes on downbeats / offbeats (Hz, 0 = rest)
const BASS_PATTERN: readonly number[] = [
  130.81, 0, 0, 0, 196.0, 0, 0, 0,
  174.61, 0, 0, 0, 130.81, 0, 0, 0,
  164.81, 0, 0, 0, 220.0, 0, 0, 0,
  196.0, 0, 0, 0, 130.81, 0, 0, 0,
]

// Bar-start warm pad chords (every 8 steps)
const PAD_CHORDS: readonly (readonly [number, number])[] = [
  [261.63, 392.0], // C4 + G4
  [220.0, 329.63], // A3 + E4
  [174.61, 261.63], // F3 + C4
  [196.0, 293.66], // G3 + D4
]

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(1, volume))
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const legacyWindow = window as unknown as { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? legacyWindow.webkitAudioContext ?? null
}

/**
 * Procedural Web Audio background music player for the Bentengan 3D homepage.
 * Synthesizes a warm, looping Indonesian pentatonic marimba/bonang & pad motif
 * with lookahead scheduling and browser autoplay unlock support.
 */
export class HomeBgmPlayer {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private warmthFilter: BiquadFilterNode | null = null
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private stopTimeout: ReturnType<typeof setTimeout> | null = null

  private isRunning = false
  private isPaused = false
  private currentStep = 0
  private nextNoteTime = 0
  private targetVolume = 0.45

  public get playing(): boolean {
    return this.isRunning && !this.isPaused && this.ctx?.state === 'running'
  }

  public get needsUserGesture(): boolean {
    return this.ctx?.state === 'suspended'
  }

  /**
   * Initializes AudioContext and starts the BGM loop if allowed by autoplay policy.
   * Returns true if AudioContext is actively running, false if awaiting user gesture.
   */
  public async start(volume: number): Promise<boolean> {
    this.clearPendingStop()
    this.targetVolume = clampVolume(volume)

    if (!this.ensureGraph()) {
      return false
    }
    if (!this.ctx || !this.masterGain) {
      return false
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        // Blocked by browser autoplay policy until user gesture
      }
    }

    if (this.ctx.state !== 'running') {
      return false
    }

    this.isPaused = false
    this.beginScheduler()
    this.rampGain(this.targetVolume * MAX_MASTER_GAIN, 0.55)
    return true
  }

  /**
   * Resumes a suspended AudioContext inside a user gesture handler and starts playback.
   */
  public async unlockAndStart(volume: number): Promise<boolean> {
    return this.start(volume)
  }

  public setVolume(volume: number): void {
    this.targetVolume = clampVolume(volume)
    if (!this.ctx || !this.masterGain || !this.isRunning || this.isPaused) return
    this.rampGain(this.targetVolume * MAX_MASTER_GAIN, 0.08)
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return
    this.isPaused = true
    this.clearScheduler()
    this.rampGain(0, 0.12)
  }

  public async resume(volume: number): Promise<void> {
    this.targetVolume = clampVolume(volume)
    if (!this.isRunning) {
      await this.start(this.targetVolume)
      return
    }
    if (!this.isPaused || !this.ctx) return

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        return
      }
    }
    if (this.ctx.state !== 'running') return

    this.isPaused = false
    this.nextNoteTime = this.ctx.currentTime + 0.05
    this.beginScheduler()
    this.rampGain(this.targetVolume * MAX_MASTER_GAIN, 0.35)
  }

  /**
   * Smoothly fades out and stops the BGM scheduler.
   */
  public stop(): void {
    this.clearScheduler()
    this.clearPendingStop()

    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.isPaused = false
    this.rampGain(0, 0.2)

    if (this.ctx && this.ctx.state === 'running') {
      this.stopTimeout = setTimeout(() => {
        if (!this.isRunning && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {})
        }
      }, 240)
    }
  }

  public dispose(): void {
    this.clearScheduler()
    this.clearPendingStop()
    this.isRunning = false
    this.isPaused = false

    try {
      this.ctx?.close()
    } catch {
      // Ignore cleanup error in headless environments
    }

    this.ctx = null
    this.masterGain = null
    this.warmthFilter = null
  }

  private ensureGraph(): boolean {
    if (this.ctx && this.masterGain && this.warmthFilter) {
      return true
    }

    try {
      const AudioCtx = getAudioContextConstructor()
      if (!AudioCtx) return false

      this.ctx = new AudioCtx()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime)

      this.warmthFilter = this.ctx.createBiquadFilter()
      this.warmthFilter.type = 'lowpass'
      this.warmthFilter.frequency.setValueAtTime(2600, this.ctx.currentTime)

      this.masterGain.connect(this.warmthFilter)
      this.warmthFilter.connect(this.ctx.destination)
      return true
    } catch {
      return false
    }
  }

  private beginScheduler(): void {
    if (!this.ctx) return

    if (!this.isRunning) {
      this.isRunning = true
      this.currentStep = 0
      this.nextNoteTime = this.ctx.currentTime + 0.06
    }

    if (this.schedulerTimer) return

    this.schedulerLoop()
    this.schedulerTimer = setInterval(() => {
      this.schedulerLoop()
    }, LOOKAHEAD_MS)
  }

  private schedulerLoop(): void {
    if (!this.ctx || !this.isRunning || this.isPaused) return
    if (this.ctx.state !== 'running') return

    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_SEC
    while (this.nextNoteTime < horizon) {
      this.scheduleStep(this.currentStep, this.nextNoteTime)
      this.nextNoteTime += STEP_DURATION_SEC
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.masterGain) return

    const melodyFreq = MELODY_PATTERN[step] ?? 0
    if (melodyFreq > 0) {
      this.triggerBonangNote(this.ctx, this.masterGain, melodyFreq, time)
    }

    const bassFreq = BASS_PATTERN[step] ?? 0
    if (bassFreq > 0) {
      this.triggerWarmBass(this.ctx, this.masterGain, bassFreq, time)
    }

    if (step % 8 === 0) {
      const chordIndex = Math.floor(step / 8) % PAD_CHORDS.length
      const chord = PAD_CHORDS[chordIndex]
      if (chord) {
        this.triggerPadChord(this.ctx, this.masterGain, chord, time)
      }
    }

    if (step % 2 === 0) {
      const isDownbeat = step % 4 === 0
      this.triggerBambooPulse(this.ctx, this.masterGain, time, isDownbeat)
    }
  }

  private triggerBonangNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
  ): void {
    const carrier = ctx.createOscillator()
    const overtone = ctx.createOscillator()
    const carrierGain = ctx.createGain()
    const overtoneGain = ctx.createGain()

    carrier.type = 'sine'
    carrier.frequency.setValueAtTime(freq, time)

    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(freq * 2, time)

    carrierGain.gain.setValueAtTime(0.001, time)
    carrierGain.gain.linearRampToValueAtTime(0.24, time + 0.012)
    carrierGain.gain.exponentialRampToValueAtTime(0.001, time + 0.44)

    overtoneGain.gain.setValueAtTime(0.001, time)
    overtoneGain.gain.linearRampToValueAtTime(0.07, time + 0.008)
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)

    carrier.connect(carrierGain)
    overtone.connect(overtoneGain)
    carrierGain.connect(dest)
    overtoneGain.connect(dest)

    carrier.start(time)
    overtone.start(time)
    carrier.stop(time + 0.46)
    overtone.stop(time + 0.2)
  }

  private triggerWarmBass(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    time: number,
  ): void {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, time)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(340, time)

    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(0.2, time + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.95)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)

    osc.start(time)
    osc.stop(time + 1.0)
  }

  private triggerPadChord(
    ctx: AudioContext,
    dest: AudioNode,
    chord: readonly [number, number],
    time: number,
  ): void {
    const duration = STEP_DURATION_SEC * 8

    for (const freq of chord) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, time)

      gain.gain.setValueAtTime(0.001, time)
      gain.gain.linearRampToValueAtTime(0.075, time + 0.45)
      gain.gain.linearRampToValueAtTime(0.055, time + duration - 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration)

      osc.connect(gain)
      gain.connect(dest)

      osc.start(time)
      osc.stop(time + duration + 0.04)
    }
  }

  private triggerBambooPulse(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    isDownbeat: boolean,
  ): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(isDownbeat ? 150 : 220, time)
    osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 72 : 125, time + 0.04)

    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(isDownbeat ? 0.11 : 0.055, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06)

    osc.connect(gain)
    gain.connect(dest)

    osc.start(time)
    osc.stop(time + 0.07)
  }

  private rampGain(target: number, timeConstantSec: number): void {
    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime
    const gainParam = this.masterGain.gain

    if (typeof gainParam.setTargetAtTime === 'function') {
      gainParam.setTargetAtTime(target, now, Math.max(0.01, timeConstantSec / 3))
    } else {
      gainParam.setValueAtTime(target, now)
    }
  }

  private clearScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
  }

  private clearPendingStop(): void {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout)
      this.stopTimeout = null
    }
  }
}

export const homeBgmPlayer = new HomeBgmPlayer()
