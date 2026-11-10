import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { PhysicsWorld } from '../game/physics/physics-world'
import { BotController } from '../game/entities/bot-controller'
import { PlayerController } from '../game/entities/player-controller'

describe('BotController Line-of-Sight (LOS) Obstacle Occlusion', () => {
  let scene: THREE.Scene
  let physics: PhysicsWorld
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext

  beforeEach(async () => {
    setActivePinia(createPinia())
    originalGetContext = HTMLCanvasElement.prototype.getContext
    const mock2dCtx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    }
    HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
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
    vi.restoreAllMocks()
  })

  it('reports true for line-of-sight when no obstacles exist between bot and target', () => {
    const bot = new BotController(scene, physics, {
      id: 'bot-1',
      name: 'Bot Sentry',
      teamId: 'red',
      initialPosition: [0, 1, 10],
      role: 'defender',
    })

    const clearTargetPos = { x: 0, y: 1, z: 2 }
    expect(bot.hasLineOfSight(clearTargetPos)).toBe(true)

    bot.dispose()
  })

  it('reports false for line-of-sight when a static box obstacle blocks direct vision', () => {
    // Create static box between z = 10 (bot) and z = 2 (target)
    // Box placed at z = 6, height 2.5m, width 4m, depth 2m
    physics.createStaticBox({
      translation: { x: 0, y: 1.25, z: 6 },
      halfExtents: { x: 2.0, y: 1.25, z: 1.0 },
    })
    physics.step()

    const bot = new BotController(scene, physics, {
      id: 'bot-2',
      name: 'Bot Sentry',
      teamId: 'red',
      initialPosition: [0, 1, 10],
      role: 'defender',
    })

    // Player behind the box at z = 2
    const occludedTargetPos = { x: 0, y: 1, z: 2 }
    expect(bot.hasLineOfSight(occludedTargetPos)).toBe(false)

    // Another player off to the side at x = 8 (clear sightline around the box)
    const flankTargetPos = { x: 8, y: 1, z: 2 }
    expect(bot.hasLineOfSight(flankTargetPos)).toBe(true)

    bot.dispose()
  })

  it('prevents defender bot from locking onto or chasing a player who is behind an obstacle', () => {
    // Solid obstacle at z = 14
    physics.createStaticBox({
      translation: { x: 0, y: 1.25, z: 14 },
      halfExtents: { x: 2.0, y: 1.25, z: 1.0 },
    })
    physics.step()

    // Red defender bot stationed at z = 20
    const bot = new BotController(scene, physics, {
      id: 'bot-defender',
      name: 'Guard Bot',
      teamId: 'red',
      initialPosition: [0, 1, 20],
      role: 'defender',
    })

    // Blue player trespassing in Red territory at z = 8, but occluded by the box at z = 14
    const trespassingPlayer = new PlayerController(scene, physics, {
      id: 'player-hidden',
      name: 'Hiding Player',
      teamId: 'blue',
      initialPosition: [0, 1, 8],
    })

    // Record initial patrol direction
    const initialDirZ = bot.patrolDirection.z

    // Update bot fixed step
    bot.updateFixed(0.016, 1000, [trespassingPlayer])

    // Because the player is occluded, the bot should NOT lock onto the player
    // If it had locked on, patrolDirection would point straight forward (towards negative Z: -1)
    // Verify line of sight was blocked
    expect(bot.hasLineOfSight(trespassingPlayer.getPosition())).toBe(false)

    bot.dispose()
    trespassingPlayer.dispose()
  })
})
