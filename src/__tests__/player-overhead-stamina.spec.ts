import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as THREE from 'three'
import { PhysicsWorld } from '../game/physics/physics-world'
import { PlayerController } from '../game/entities/player-controller'
import { BotController } from '../game/entities/bot-controller'
import { RemotePlayerController } from '../game/entities/remote-player-controller'

describe('PlayerController Overhead World-Space Stamina & Nameplate', () => {
  let scene: THREE.Scene
  let physics: PhysicsWorld
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
  let mock2dCtx: Record<string, unknown>

  beforeEach(async () => {
    originalGetContext = HTMLCanvasElement.prototype.getContext
    mock2dCtx = {
      clearRect: vi.fn<() => void>(),
      beginPath: vi.fn<() => void>(),
      moveTo: vi.fn<() => void>(),
      lineTo: vi.fn<() => void>(),
      quadraticCurveTo: vi.fn<() => void>(),
      closePath: vi.fn<() => void>(),
      fill: vi.fn<() => void>(),
      stroke: vi.fn<() => void>(),
      arc: vi.fn<() => void>(),
      fillText: vi.fn<() => void>(),
      strokeText: vi.fn<() => void>(),
    }
    HTMLCanvasElement.prototype.getContext = vi.fn<
      (contextId: string, options?: unknown) => RenderingContext | null
    >((contextId: string) => {
      if (contextId === '2d') {
        return mock2dCtx as unknown as RenderingContext
      }
      return null
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    scene = new THREE.Scene()
    physics = await PhysicsWorld.create()
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    physics.dispose()
  })

  it('creates and attaches overhead billboard sprite with player name to player mesh', () => {
    const player = new PlayerController(scene, physics, {
      id: 'local-test',
      name: 'Budi Super',
      teamId: 'blue',
      initialPosition: [0, 1, -20],
    })

    expect(player.overheadSprite).toBeDefined()
    expect(player.mesh.children).toContain(player.overheadSprite)
    expect(player.overheadSprite.position.y).toBeCloseTo(1.15, 2)
    expect(player.overheadSprite.material.depthTest).toBe(true)
    expect(player.overheadSprite.material.depthWrite).toBe(false)

    player.dispose()
  })

  it('updates overhead display when stamina changes and avoids redraw when unchanged', () => {
    const player = new PlayerController(scene, physics, {
      id: 'local-test',
      name: 'Siti Sprint',
      teamId: 'red',
      initialPosition: [0, 1, 20],
    })

    // Initial creation already drew once
    // @ts-expect-error accessing private property for white-box test
    const texture = player.overheadTexture as THREE.CanvasTexture
    const initialVersion = texture.version

    // Sync without changes -> version remains unchanged
    player.syncVisuals()
    expect(texture.version).toBe(initialVersion)

    // Drain stamina -> syncVisuals must increment texture.version
    player.stamina = 70
    player.syncVisuals()
    expect(texture.version).toBeGreaterThan(initialVersion)

    const updatedVersion = texture.version
    // Sync without further change -> version remains unchanged
    player.syncVisuals()
    expect(texture.version).toBe(updatedVersion)

    // Stun status change triggers update
    player.status = 'stunned'
    player.syncVisuals()
    expect(texture.version).toBeGreaterThan(updatedVersion)

    player.dispose()
  })

  it('adjusts overhead sprite opacity on setVisualOpacity', () => {
    const player = new PlayerController(scene, physics, {
      id: 'local-test',
      name: 'Fade Test',
      teamId: 'blue',
      initialPosition: [0, 1, 0],
    })

    player.setVisualOpacity(0.5)
    expect(player.overheadSprite.material.opacity).toBe(0.5)

    player.setVisualOpacity(1.0)
    expect(player.overheadSprite.material.opacity).toBe(1.0)

    player.dispose()
  })

  it('disposes overhead texture and material cleanly on player.dispose()', () => {
    const player = new PlayerController(scene, physics, {
      id: 'local-test',
      name: 'Dispose Test',
      teamId: 'blue',
      initialPosition: [0, 1, 0],
    })

    // @ts-expect-error accessing private property for white-box test
    const texture = player.overheadTexture as THREE.CanvasTexture
    const spriteMat = player.overheadSprite.material

    const textureDisposeSpy = vi.spyOn(texture, 'dispose')
    const matDisposeSpy = vi.spyOn(spriteMat, 'dispose')

    player.dispose()

    expect(textureDisposeSpy).toHaveBeenCalled()
    expect(matDisposeSpy).toHaveBeenCalled()
  })

  it('enables depthTest and disables depthWrite on BotController and RemotePlayerController', () => {
    const bot = new BotController(scene, physics, {
      id: 'bot-depth-test',
      name: 'Bot Cerdas',
      teamId: 'red',
      initialPosition: [5, 1, 20],
      role: 'defender',
    })

    expect(bot.overheadSprite.material.depthTest).toBe(true)
    expect(bot.overheadSprite.material.depthWrite).toBe(false)
    bot.dispose()

    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-depth-test',
      name: 'Pemain Jauh',
      teamId: 'blue',
      initialPosition: [-5, 1, -20],
    })

    const remoteSprite = remote.mesh.children.find((c) => c instanceof THREE.Sprite) as THREE.Sprite
    expect(remoteSprite).toBeDefined()
    expect(remoteSprite.material.depthTest).toBe(true)
    expect(remoteSprite.material.depthWrite).toBe(false)
    remote.dispose(scene)
  })
})
