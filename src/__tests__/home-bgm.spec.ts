import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { HomeBgmPlayer } from '../game/audio/home-bgm'
import HomeTopHud from '../components/home/HomeTopHud.vue'
import HomeView from '../views/HomeView.vue'
import { useSettingsStore } from '../stores/settings-store'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn<(to: string) => void>(),
    replace: vi.fn<(to: string) => void>(),
  }),
  useRoute: () => ({
    params: {},
    query: {},
  }),
  onBeforeRouteLeave: vi.fn<(cb: () => void) => void>(),
}))

interface MockAudioInstance {
  src: string
  loop: boolean
  preload: string
  volume: number
  muted: boolean
  paused: boolean
  currentTime: number
  play: ReturnType<typeof vi.fn<() => Promise<void>>>
  pause: ReturnType<typeof vi.fn<() => void>>
  load: ReturnType<typeof vi.fn<() => void>>
  removeAttribute: ReturnType<typeof vi.fn<(attr: string) => void>>
}

describe('Homepage Background Music (HomeBgmPlayer & HUD Integration)', () => {
  const originalAudio = globalThis.Audio

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.Audio = originalAudio
    vi.restoreAllMocks()
  })

  it('handles all lifecycle methods safely without crashing in headless environment', async () => {
    Object.defineProperty(globalThis, 'Audio', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const player = new HomeBgmPlayer()
    await expect(player.start(0.5)).resolves.toBe(false)
    await expect(player.unlockAndStart(0.5)).resolves.toBe(false)
    expect(() => {
      player.setVolume(0.3)
      player.pause()
      player.stop()
      player.dispose()
    }).not.toThrow()
    expect(player.playing).toBe(false)
  })

  it('streams /audio/homepage.mp3 in a loop and handles volume, pause, resume, and stop', async () => {
    const mockAudio: MockAudioInstance = {
      src: '',
      loop: false,
      preload: '',
      volume: 1,
      muted: false,
      paused: true,
      currentTime: 12,
      play: vi.fn<() => Promise<void>>(async () => {
        mockAudio.paused = false
      }),
      pause: vi.fn<() => void>(() => {
        mockAudio.paused = true
      }),
      load: vi.fn<() => void>(),
      removeAttribute: vi.fn<(attr: string) => void>(),
    }

    class MockAudio {
      constructor(src = '') {
        mockAudio.src = src
        return mockAudio as unknown as MockAudio
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      value: MockAudio,
      configurable: true,
      writable: true,
    })

    const player = new HomeBgmPlayer()
    const started = await player.start(0.6)

    expect(started).toBe(true)
    expect(player.playing).toBe(true)
    expect(mockAudio.src).toBe('/audio/homepage.mp3')
    expect(mockAudio.loop).toBe(true)
    expect(mockAudio.preload).toBe('auto')

    // Fade-in finishes to target volume
    vi.advanceTimersByTime(500)
    expect(mockAudio.volume).toBeCloseTo(0.6, 2)
    expect(mockAudio.muted).toBe(false)

    // Volume update while playing
    player.setVolume(0.25)
    vi.advanceTimersByTime(120)
    expect(mockAudio.volume).toBeCloseTo(0.25, 2)

    // Pause fades out and pauses audio
    player.pause()
    vi.advanceTimersByTime(160)
    expect(mockAudio.pause).toHaveBeenCalled()
    expect(player.playing).toBe(false)

    // Resume restarts playback and fades back up
    await player.resume(0.5)
    vi.advanceTimersByTime(350)
    expect(player.playing).toBe(true)
    expect(mockAudio.volume).toBeCloseTo(0.5, 2)

    // Stop fades out, pauses, and rewinds currentTime
    player.stop()
    vi.advanceTimersByTime(260)
    expect(player.playing).toBe(false)
    expect(mockAudio.currentTime).toBe(0)

    player.dispose()
    expect(mockAudio.removeAttribute).toHaveBeenCalledWith('src')
  })

  it('defers playback when browser autoplay rejects play() until user gesture unlock', async () => {
    class AutoplayBlockedAudio {
      public src: string
      public loop = false
      public preload = ''
      public volume = 1
      public muted = false
      public paused = true
      public currentTime = 0

      // First attempt blocked by autoplay; second attempt (gesture) succeeds
      public play = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('NotAllowedError'))
        .mockImplementationOnce(async () => {
          this.paused = false
        })

      public pause = vi.fn<() => void>(() => {
        this.paused = true
      })

      public load = vi.fn<() => void>()
      public removeAttribute = vi.fn<(attr: string) => void>()

      constructor(src = '') {
        this.src = src
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      value: AutoplayBlockedAudio,
      configurable: true,
      writable: true,
    })

    const player = new HomeBgmPlayer()

    const firstTry = await player.start(0.5)
    expect(firstTry).toBe(false)
    expect(player.playing).toBe(false)
    expect(player.needsUserGesture).toBe(true)

    const unlocked = await player.unlockAndStart(0.5)
    expect(unlocked).toBe(true)
    expect(player.playing).toBe(true)
    expect(player.needsUserGesture).toBe(false)

    player.dispose()
  })

  it('renders quick audio mute button in HomeTopHud and toggles mute state in HomeView', async () => {
    const hudWrapper = mount(HomeTopHud, {
      props: {
        isMobileMenuOpen: false,
        isMuted: false,
      },
    })

    const btn = hudWrapper.find('[data-testid="navbar-audio-toggle-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(hudWrapper.emitted('toggle-mute')).toBeTruthy()

    const homeWrapper = mount(HomeView)
    const settings = useSettingsStore()
    expect(settings.isMuted).toBe(false)

    await homeWrapper.find('[data-testid="navbar-audio-toggle-btn"]').trigger('click')
    expect(settings.isMuted).toBe(true)

    await homeWrapper.find('[data-testid="navbar-audio-toggle-btn"]').trigger('click')
    expect(settings.isMuted).toBe(false)

    homeWrapper.unmount()
  })
})
