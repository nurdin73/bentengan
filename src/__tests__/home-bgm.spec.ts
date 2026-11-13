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

interface MockAudioParam {
  setValueAtTime: ReturnType<typeof vi.fn<() => void>>
  linearRampToValueAtTime: ReturnType<typeof vi.fn<() => void>>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn<() => void>>
  setTargetAtTime: ReturnType<typeof vi.fn<() => void>>
}

interface MockGainNode {
  gain: MockAudioParam
  connect: ReturnType<typeof vi.fn<() => void>>
}

interface MockOscillatorNode {
  type: OscillatorType
  frequency: MockAudioParam
  connect: ReturnType<typeof vi.fn<() => void>>
  start: ReturnType<typeof vi.fn<() => void>>
  stop: ReturnType<typeof vi.fn<() => void>>
}

interface MockBiquadFilterNode {
  type: BiquadFilterType
  frequency: MockAudioParam
  connect: ReturnType<typeof vi.fn<() => void>>
}

function createMockAudioParam(): MockAudioParam {
  return {
    setValueAtTime: vi.fn<() => void>(),
    linearRampToValueAtTime: vi.fn<() => void>(),
    exponentialRampToValueAtTime: vi.fn<() => void>(),
    setTargetAtTime: vi.fn<() => void>(),
  }
}

describe('Homepage Background Music (HomeBgmPlayer & HUD Integration)', () => {
  const originalAudioContext = window.AudioContext

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.AudioContext = originalAudioContext
    vi.restoreAllMocks()
  })

  it('handles all lifecycle methods safely without crashing in headless environment', async () => {
    // Ensure AudioContext is unavailable
    Object.defineProperty(window, 'AudioContext', {
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

  it('schedules Web Audio nodes when AudioContext is running and handles pause/resume/stop', async () => {
    const createdOscillators: MockOscillatorNode[] = []
    const createdGains: MockGainNode[] = []
    let ctxState: AudioContextState = 'running'

    class MockAudioContext {
      public currentTime = 0
      public destination = {} as AudioDestinationNode

      public get state(): AudioContextState {
        return ctxState
      }

      public resume = vi.fn<() => Promise<void>>(async () => {
        ctxState = 'running'
      })

      public suspend = vi.fn<() => Promise<void>>(async () => {
        ctxState = 'suspended'
      })

      public close = vi.fn<() => Promise<void>>(async () => {
        ctxState = 'closed'
      })

      public createGain = vi.fn<() => GainNode>(() => {
        const node: MockGainNode = {
          gain: createMockAudioParam(),
          connect: vi.fn<() => void>(),
        }
        createdGains.push(node)
        return node as unknown as GainNode
      })

      public createBiquadFilter = vi.fn<() => BiquadFilterNode>(() => {
        const node: MockBiquadFilterNode = {
          type: 'lowpass',
          frequency: createMockAudioParam(),
          connect: vi.fn<() => void>(),
        }
        return node as unknown as BiquadFilterNode
      })

      public createOscillator = vi.fn<() => OscillatorNode>(() => {
        const node: MockOscillatorNode = {
          type: 'sine',
          frequency: createMockAudioParam(),
          connect: vi.fn<() => void>(),
          start: vi.fn<() => void>(),
          stop: vi.fn<() => void>(),
        }
        createdOscillators.push(node)
        return node as unknown as OscillatorNode
      })
    }

    Object.defineProperty(window, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
      writable: true,
    })

    const player = new HomeBgmPlayer()
    const started = await player.start(0.6)

    expect(started).toBe(true)
    expect(player.playing).toBe(true)
    expect(createdOscillators.length).toBeGreaterThan(0)

    // Master gain ramps up
    const masterGain = createdGains[0]
    expect(masterGain?.gain.setTargetAtTime).toHaveBeenCalled()

    // Volume update while running
    player.setVolume(0.25)
    expect(masterGain?.gain.setTargetAtTime).toHaveBeenCalledTimes(2)

    // Pause silences master gain
    player.pause()
    expect(player.playing).toBe(false)

    // Resume restores playback
    await player.resume(0.5)
    expect(player.playing).toBe(true)

    // Stop schedules fade out and suspends
    player.stop()
    expect(player.playing).toBe(false)
    vi.advanceTimersByTime(300)

    player.dispose()
  })

  it('defers playback when browser autoplay suspends AudioContext until user gesture unlock', async () => {
    let ctxState: AudioContextState = 'suspended'

    class SuspendedAudioContext {
      public currentTime = 0
      public destination = {} as AudioDestinationNode

      public get state(): AudioContextState {
        return ctxState
      }

      // First resume (without gesture) remains suspended; second (with gesture) unlocks
      public resume = vi
        .fn<() => Promise<void>>()
        .mockImplementationOnce(async () => {
          ctxState = 'suspended'
        })
        .mockImplementationOnce(async () => {
          ctxState = 'running'
        })

      public suspend = vi.fn<() => Promise<void>>(async () => {
        ctxState = 'suspended'
      })

      public close = vi.fn<() => Promise<void>>(async () => {
        ctxState = 'closed'
      })

      public createGain = vi.fn<() => GainNode>(
        () =>
          ({
            gain: createMockAudioParam(),
            connect: vi.fn<() => void>(),
          }) as unknown as GainNode,
      )

      public createBiquadFilter = vi.fn<() => BiquadFilterNode>(
        () =>
          ({
            type: 'lowpass',
            frequency: createMockAudioParam(),
            connect: vi.fn<() => void>(),
          }) as unknown as BiquadFilterNode,
      )

      public createOscillator = vi.fn<() => OscillatorNode>(
        () =>
          ({
            type: 'sine',
            frequency: createMockAudioParam(),
            connect: vi.fn<() => void>(),
            start: vi.fn<() => void>(),
            stop: vi.fn<() => void>(),
          }) as unknown as OscillatorNode,
      )
    }

    Object.defineProperty(window, 'AudioContext', {
      value: SuspendedAudioContext,
      configurable: true,
      writable: true,
    })

    const player = new HomeBgmPlayer()

    // Initial cold-load start blocked by autoplay policy
    const firstTry = await player.start(0.5)
    expect(firstTry).toBe(false)
    expect(player.playing).toBe(false)
    expect(player.needsUserGesture).toBe(true)

    // User gesture triggers unlockAndStart
    const unlocked = await player.unlockAndStart(0.5)
    expect(unlocked).toBe(true)
    expect(player.playing).toBe(true)

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
