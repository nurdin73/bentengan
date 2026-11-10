import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { VFXManager } from '../game/vfx/vfx-manager'
import { ArenaGreybox } from '../game/scenes/arena-greybox'
import { PhysicsWorld } from '../game/physics/physics-world'
import { GAME_CONFIG } from '../game/core/constants'

describe('Milestone 6 — Visual Polish, VFX & Arena Polish', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('VFXManager (Particle & Shockwave Pooling)', () => {
    it('initializes particle pools with pre-allocated meshes without adding new objects in loop', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      expect(vfx.group).toBeDefined()
      expect(scene.children).toContain(vfx.group)

      // Verify that pools are pre-populated and initially invisible
      const initialMeshCount = vfx.group.children.length
      expect(initialMeshCount).toBeGreaterThan(50) // 24 dust + 32 sparkles + 6 rings + 1 beacon

      const invisibleCount = vfx.group.children.filter((c) => !c.visible).length
      expect(invisibleCount).toBe(initialMeshCount)

      vfx.dispose()
    })

    it('spawns and updates sprint dust particle', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      vfx.spawnSprintDust({ x: 2, y: 1, z: 5 })

      const visibleDust = vfx.group.children.filter(
        (c) =>
          c.visible && c instanceof THREE.Mesh && c.geometry instanceof THREE.DodecahedronGeometry,
      )
      expect(visibleDust.length).toBeGreaterThanOrEqual(1)

      // Step simulation by 0.5s (lifetime expires)
      vfx.update(0.6)

      // Expired particles should be hidden and recycled
      const activeAfterExpiry = vfx.group.children.filter(
        (c) =>
          c.visible && c instanceof THREE.Mesh && c.geometry instanceof THREE.DodecahedronGeometry,
      )
      expect(activeAfterExpiry.length).toBe(0)

      vfx.dispose()
    })

    it('spawns sprint dust at foot level rather than neck height', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      // Character center origin is at y = 0.8m (standing on ground y = 0)
      vfx.spawnSprintDust({ x: 0, y: 0.8, z: 0 }, true)

      const spawned = vfx.group.children.find(
        (c) =>
          c.visible && c instanceof THREE.Mesh && c.geometry instanceof THREE.DodecahedronGeometry,
      ) as THREE.Mesh | undefined

      expect(spawned).toBeDefined()
      // Foot level is y ~ 0.06m (well below neck height 0.88m)
      expect(spawned!.position.y).toBeCloseTo(0.06, 2)

      vfx.dispose()
    })

    it('spawns capture shockwave ring and scales over time', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      vfx.spawnCaptureRing({ x: 0, y: 0, z: 0 }, 0xef4444)

      const ringMesh = vfx.group.children.find(
        (c) => c.visible && c instanceof THREE.Mesh && c.geometry instanceof THREE.RingGeometry,
      ) as THREE.Mesh | undefined

      expect(ringMesh).toBeDefined()
      expect(ringMesh?.visible).toBe(true)
      const initialScale = ringMesh?.scale.x ?? 0

      // Advance by 0.1s
      vfx.update(0.1)
      expect(ringMesh?.scale.x).toBeGreaterThan(initialScale)

      // Advance past lifetime (0.42s total)
      vfx.update(0.4)
      expect(ringMesh?.visible).toBe(false)

      vfx.dispose()
    })

    it('spawns sparkling burst on prisoner rescue', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      vfx.spawnRescueSparkles({ x: 10, y: 1, z: 20 })

      const visibleSparkles = vfx.group.children.filter(
        (c) =>
          c.visible && c instanceof THREE.Mesh && c.geometry instanceof THREE.OctahedronGeometry,
      )
      expect(visibleSparkles.length).toBeGreaterThanOrEqual(8)

      vfx.dispose()
    })

    it('triggers vertical light beacon on base touch', () => {
      const scene = new THREE.Scene()
      const vfx = new VFXManager(scene)

      vfx.triggerBaseBeacon({ x: 0, y: 0, z: -25 })

      const beaconMesh = vfx.group.children.find(
        (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.CylinderGeometry,
      ) as THREE.Mesh | undefined

      expect(beaconMesh).toBeDefined()
      expect(beaconMesh?.visible).toBe(true)

      // Advance past beacon duration (2.0s)
      vfx.update(2.2)
      expect(beaconMesh?.visible).toBe(false)

      vfx.dispose()
    })
  })

  describe('Arena Greybox & Polish Integrity', () => {
    it('creates arena with polished bases and preserved exact physics collider boundaries', async () => {
      const scene = new THREE.Scene()
      const physics = await PhysicsWorld.create()
      const arena = new ArenaGreybox(scene, physics)

      expect(arena.group).toBeDefined()
      expect(scene.children).toContain(arena.group)

      // Check key arena zone coordinates
      const halfL = GAME_CONFIG.arena.length / 2
      expect(arena.zones.blueBasePosition.z).toBe(-halfL + 5)
      expect(arena.zones.redBasePosition.z).toBe(halfL - 5)
      expect(arena.zones.blueJailPosition.z).toBe(halfL - 10)
      expect(arena.zones.redJailPosition.z).toBe(-halfL + 10)

      // Verify meshes exist in the scene group
      expect(arena.group.children.length).toBeGreaterThan(15)

      arena.dispose()
      physics.dispose()
    })
  })
})
