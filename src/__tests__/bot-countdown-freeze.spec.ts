import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameEngine } from '../game/core/engine'
import { useGameStore } from '../stores/game-store'

describe('Bot Pre-Match Countdown Freeze', () => {
  let container: HTMLDivElement
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalRAF = window.requestAnimationFrame

  beforeEach(() => {
    setActivePinia(createPinia())
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)

    window.requestAnimationFrame = vi.fn<typeof window.requestAnimationFrame>((cb) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })

    const baseGl: Record<string, unknown> = {
      VERSION: 7938,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      HIGH_FLOAT: 36338,
      MEDIUM_FLOAT: 36337,
      LOW_FLOAT: 36336,
      MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
      MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
      MAX_RENDERBUFFER_SIZE: 34024,
      MAX_TEXTURE_SIZE: 3379,
      MAX_VERTEX_ATTRIBS: 34921,
      MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
      MAX_TEXTURE_IMAGE_UNITS: 34930,
      MAX_VERTEX_UNIFORM_VECTORS: 36347,
      MAX_VARYING_VECTORS: 36348,
      MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
      canvas: document.createElement('canvas'),
      getExtension: () => null,
      getParameter: (param: number) => {
        if (param === 7938) return 'WebGL 1.0'
        return 2048
      },
      getShaderPrecisionFormat: () => ({ rangeMin: 1, rangeMax: 1, precision: 1 }),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
    }

    const proxyGl = new Proxy(baseGl, {
      get(target, prop) {
        if (prop in target) {
          return target[prop as string]
        }
        return () => ({})
      },
    })

    HTMLCanvasElement.prototype.getContext = vi.fn<
      (contextId: string, options?: unknown) => RenderingContext | null
    >((contextId: string) => {
      if (contextId.includes('webgl') || contextId === 'experimental-webgl') {
        return proxyGl as unknown as RenderingContext
      }
      return null
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    window.requestAnimationFrame = originalRAF
    container.remove()
    vi.restoreAllMocks()
  })

  function createTestEngine(): GameEngine {
    const engine = new GameEngine(container, {
      onPlayerStateChange: vi.fn(),
      onRosterUpdate: vi.fn(),
      onCapture: vi.fn(),
      onRescue: vi.fn(),
      onMatchEnd: vi.fn(),
    })
    engine.renderer.render = vi.fn()
    return engine
  }

  it('freezes all bots while countdown is active during practice match init', async () => {
    const engine = createTestEngine()

    await engine.init({
      localPlayerId: 'local-test',
      localPlayerUsername: 'Tester',
      teamId: 'blue',
      isPractice: true,
      skipCountdown: false,
    })

    expect(engine.isCountdownActive).toBe(true)
    expect(engine.bots.length).toBeGreaterThan(0)

    for (const bot of engine.bots) {
      expect(bot.isFrozen).toBe(true)
    }

    // Call finishCountdown to simulate countdown completion
    engine.finishCountdown()

    expect(engine.isCountdownActive).toBe(false)
    for (const bot of engine.bots) {
      expect(bot.isFrozen).toBe(false)
    }

    engine.dispose()
  })

  it('skips countdown freeze when skipCountdown init option is explicitly true', async () => {
    const engine = createTestEngine()

    await engine.init({
      localPlayerId: 'local-test',
      localPlayerUsername: 'Tester',
      teamId: 'blue',
      isPractice: true,
      skipCountdown: true,
    })

    expect(engine.isCountdownActive).toBe(false)
    for (const bot of engine.bots) {
      expect(bot.isFrozen).toBe(false)
    }

    engine.dispose()
  })

  it('updates Pinia gameStore countdown status correctly', () => {
    const store = useGameStore()
    expect(store.isCountdownActive).toBe(true)

    store.finishCountdown()
    expect(store.isCountdownActive).toBe(false)

    store.resetStats()
    expect(store.isCountdownActive).toBe(true)
  })
})
