const HOME_BGM_SRC = `${import.meta.env.BASE_URL ?? '/'}audio/homepage.mp3`.replace(/\/{2,}/g, '/')
const FADE_STEP_MS = 25
const FADE_IN_MS = 450
const FADE_OUT_MS = 220

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(1, volume))
}

/**
 * Background music player for the Bentengan 3D homepage backed by /audio/homepage.mp3.
 * Handles streaming playback, looping, smooth volume fades, browser autoplay unlock,
 * and clean disposal when navigating away from the homepage.
 */
export class HomeBgmPlayer {
  private audio: HTMLAudioElement | null = null
  private fadeTimer: ReturnType<typeof setInterval> | null = null

  private isPlayingState = false
  private isPausedState = false
  private awaitingGesture = false
  private targetVolume = 0.45

  public get playing(): boolean {
    return (
      this.isPlayingState &&
      !this.isPausedState &&
      this.audio !== null &&
      !this.audio.paused
    )
  }

  public get needsUserGesture(): boolean {
    return this.awaitingGesture
  }

  /**
   * Loads /audio/homepage.mp3 if needed and starts looping playback.
   * Returns true if playback started, or false if blocked by browser autoplay policy.
   */
  public async start(volume: number): Promise<boolean> {
    this.clearFadeTimer()
    this.targetVolume = clampVolume(volume)

    const audio = this.ensureAudioElement()
    if (!audio) return false

    if (this.targetVolume <= 0) {
      audio.volume = 0
      audio.muted = true
      return false
    }

    audio.volume = 0
    audio.muted = false

    const started = await this.tryPlay(audio)
    if (!started) {
      this.isPlayingState = false
      this.awaitingGesture = true
      return false
    }

    this.awaitingGesture = false
    this.isPlayingState = true
    this.isPausedState = false
    this.fadeTo(this.targetVolume, FADE_IN_MS)
    return true
  }

  /**
   * Attempts playback inside a user gesture handler to satisfy browser autoplay policy.
   */
  public async unlockAndStart(volume: number): Promise<boolean> {
    return this.start(volume)
  }

  public setVolume(volume: number): void {
    this.targetVolume = clampVolume(volume)
    if (!this.audio || !this.isPlayingState || this.isPausedState) return

    this.fadeTo(this.targetVolume, 80)
  }

  public pause(): void {
    if (!this.audio || !this.isPlayingState || this.isPausedState) return
    this.isPausedState = true
    const audio = this.audio

    this.fadeTo(0, 120, () => {
      if (this.isPausedState) {
        audio.pause()
      }
    })
  }

  public async resume(volume: number): Promise<void> {
    this.targetVolume = clampVolume(volume)
    if (!this.isPlayingState || !this.audio) {
      await this.start(this.targetVolume)
      return
    }
    if (!this.isPausedState) {
      this.setVolume(this.targetVolume)
      return
    }

    if (this.targetVolume <= 0) {
      this.audio.volume = 0
      this.audio.muted = true
      return
    }

    this.audio.muted = false
    const started = await this.tryPlay(this.audio)
    if (!started) {
      this.awaitingGesture = true
      return
    }

    this.awaitingGesture = false
    this.isPausedState = false
    this.fadeTo(this.targetVolume, 300)
  }

  /**
   * Smoothly fades out, pauses playback, and rewinds the track for the next visit.
   */
  public stop(): void {
    this.clearFadeTimer()

    if (!this.audio) {
      this.isPlayingState = false
      this.isPausedState = false
      this.awaitingGesture = false
      return
    }

    const audio = this.audio
    const wasActive = this.isPlayingState && !audio.paused
    this.isPlayingState = false
    this.isPausedState = false
    this.awaitingGesture = false

    if (!wasActive) {
      audio.pause()
      this.resetCurrentTime(audio)
      return
    }

    this.fadeTo(0, FADE_OUT_MS, () => {
      if (!this.isPlayingState) {
        audio.pause()
        this.resetCurrentTime(audio)
      }
    })
  }

  public dispose(): void {
    this.clearFadeTimer()
    this.isPlayingState = false
    this.isPausedState = false
    this.awaitingGesture = false

    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.removeAttribute('src')
        this.audio.load()
      } catch {
        // Ignore cleanup error in headless environments
      }
      this.audio = null
    }
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (this.audio) return this.audio
    if (typeof Audio !== 'function') return null

    try {
      const audio = new Audio(HOME_BGM_SRC)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0
      this.audio = audio
      return audio
    } catch {
      return null
    }
  }

  private async tryPlay(audio: HTMLAudioElement): Promise<boolean> {
    if (typeof audio.play !== 'function') return false

    try {
      const maybePromise = audio.play() as Promise<void> | undefined
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
        return !audio.paused
      }
      return !audio.paused
    } catch {
      return false
    }
  }

  private resetCurrentTime(audio: HTMLAudioElement): void {
    try {
      audio.currentTime = 0
    } catch {
      // Ignore seek error if metadata is not yet loaded
    }
  }

  private fadeTo(targetVol: number, durationMs: number, onComplete?: () => void): void {
    this.clearFadeTimer()
    if (!this.audio) {
      onComplete?.()
      return
    }

    const audio = this.audio
    const clampedTarget = clampVolume(targetVol)
    if (clampedTarget > 0) {
      audio.muted = false
    }

    const startVol = audio.volume
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
    if (steps <= 1 || Math.abs(clampedTarget - startVol) < 0.005) {
      audio.volume = clampedTarget
      if (clampedTarget <= 0) {
        audio.muted = true
      }
      onComplete?.()
      return
    }

    let step = 0
    this.fadeTimer = setInterval(() => {
      step++
      const progress = Math.min(1, step / steps)
      audio.volume = clampVolume(startVol + (clampedTarget - startVol) * progress)

      if (progress >= 1) {
        this.clearFadeTimer()
        if (clampedTarget <= 0) {
          audio.muted = true
        }
        onComplete?.()
      }
    }, FADE_STEP_MS)
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  }
}

export const homeBgmPlayer = new HomeBgmPlayer()
