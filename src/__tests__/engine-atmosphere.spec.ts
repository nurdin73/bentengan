import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { GameEngine } from '../game/core/engine'

describe('GameEngine Atmosphere & Lighting Setup', () => {
  let container: HTMLDivElement
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
  let originalRAF: typeof window.requestAnimationFrame

  beforeEach(() => {
    setActivePinia(createPinia())
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 1280, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 720, configurable: true })
    document.body.appendChild(container)

    originalRAF = window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 0)

    originalGetContext = HTMLCanvasElement.prototype.getContext
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

  function createEngineInstance(): GameEngine {
    return new GameEngine(container, {
      onPlayerStateChange: vi.fn<() => void>(),
      onRosterUpdate: vi.fn<() => void>(),
      onCapture: vi.fn<() => void>(),
      onRescue: vi.fn<() => void>(),
      onMatchEnd: vi.fn<() => void>(),
    })
  }

  it('configures daytime stylized sky background and horizon fog', () => {
    const engine = createEngineInstance()

    // Verify sky background color
    expect(engine.scene.background).toBeInstanceOf(THREE.Color)
    const bgColor = engine.scene.background as THREE.Color
    expect(bgColor.getHex()).toBe(0x7dd3fc)

    // Verify horizon fog
    expect(engine.scene.fog).toBeInstanceOf(THREE.Fog)
    const fog = engine.scene.fog as THREE.Fog
    expect(fog.color.getHex()).toBe(0x7dd3fc)
    expect(fog.near).toBe(45)
    expect(fog.far).toBe(95)

    engine.dispose()
  })

  it('configures hemisphere light, ambient fill, and directional sun light with shadows', () => {
    const engine = createEngineInstance()

    const hemiLight = engine.scene.children.find(
      (c) => c instanceof THREE.HemisphereLight,
    ) as THREE.HemisphereLight
    expect(hemiLight).toBeDefined()
    expect(hemiLight.color.getHex()).toBe(0xbae6fd)
    expect(hemiLight.groundColor.getHex()).toBe(0x4d7c0f)
    expect(hemiLight.intensity).toBeCloseTo(0.65)

    const ambientLight = engine.scene.children.find(
      (c) => c instanceof THREE.AmbientLight,
    ) as THREE.AmbientLight
    expect(ambientLight).toBeDefined()
    expect(ambientLight.intensity).toBeCloseTo(0.25)

    const dirLight = engine.scene.children.find(
      (c) => c instanceof THREE.DirectionalLight,
    ) as THREE.DirectionalLight
    expect(dirLight).toBeDefined()
    expect(dirLight.castShadow).toBe(true)
    expect(dirLight.intensity).toBeCloseTo(1.25)
    expect(dirLight.position.x).toBe(22)
    expect(dirLight.position.y).toBe(38)
    expect(dirLight.position.z).toBe(18)

    engine.dispose()
  })

  it('initializes ArenaAmbientWind in scene and disposes on engine teardown', () => {
    const engine = createEngineInstance()

    expect(engine.ambientWind).toBeDefined()
    expect(engine.ambientWind.group).toBeDefined()
    expect(engine.scene.children).toContain(engine.ambientWind.group)
    expect(engine.ambientWind.leaves.length).toBe(32)
    expect(engine.ambientWind.ribbons.length).toBe(5)

    engine.dispose()
    expect(engine.scene.children).not.toContain(engine.ambientWind.group)
  })
})
