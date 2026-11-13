import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { ArenaAmbientWind } from '../game/scenes/arena-ambient-wind'
import { useSettingsStore } from '../stores/settings-store'

describe('ArenaAmbientWind — 3D Arena Ambient Wind System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('initializes leaves and ribbons in scene with pre-allocated meshes', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    expect(wind.group).toBeDefined()
    expect(scene.children).toContain(wind.group)
    expect(wind.leaves.length).toBe(32)
    expect(wind.ribbons.length).toBe(5)

    // Verify all meshes are linked as children of the wind group
    const leafMeshes = wind.leaves.map((l) => l.mesh)
    const ribbonMeshes = wind.ribbons.map((r) => r.mesh)

    for (const mesh of leafMeshes) {
      expect(wind.group.children).toContain(mesh)
      expect(mesh.visible).toBe(true)
    }

    for (const mesh of ribbonMeshes) {
      expect(wind.group.children).toContain(mesh)
      expect(mesh.visible).toBe(true)
    }

    wind.dispose()
  })

  it('spawns leaves within valid arena bounds', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    for (const leaf of wind.leaves) {
      expect(leaf.position.x).toBeGreaterThanOrEqual(-24)
      expect(leaf.position.x).toBeLessThanOrEqual(24)
      expect(leaf.position.y).toBeGreaterThanOrEqual(0.4)
      expect(leaf.position.y).toBeLessThanOrEqual(7.2)
      expect(leaf.position.z).toBeGreaterThanOrEqual(-38)
      expect(leaf.position.z).toBeLessThanOrEqual(38)
    }

    wind.dispose()
  })

  it('updates leaf positions, rotations, and oscillates sway on update()', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    const firstLeaf = wind.leaves[0]!
    const initialX = firstLeaf.position.x
    const initialRotY = firstLeaf.mesh.rotation.y

    // Advance 0.5s of wind simulation
    wind.update(0.5)

    // Position and rotation should have moved along wind vector
    expect(firstLeaf.position.x).not.toBe(initialX)
    expect(firstLeaf.mesh.rotation.y).not.toBe(initialRotY)

    wind.dispose()
  })

  it('wraps leaves back to upwind boundary when leaving arena bounds', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    const leaf = wind.leaves[0]!
    // Manually force leaf beyond maxX
    leaf.position.set(30, 3, 0)

    wind.update(0.016)

    // Should have wrapped back near minX (-24)
    expect(leaf.position.x).toBeGreaterThanOrEqual(-24)
    expect(leaf.position.x).toBeLessThan(-15)

    wind.dispose()
  })

  it('adapts active particle counts dynamically based on particleDensity setting', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)
    const settings = useSettingsStore()

    // Default is high: 32 leaves, 5 ribbons
    expect(wind.leaves.filter((l) => l.active && l.mesh.visible).length).toBe(32)
    expect(wind.ribbons.filter((r) => r.active && r.mesh.visible).length).toBe(5)

    // Switch to low density
    settings.setParticleDensity('low')
    wind.applyDensity('low')

    const activeLeavesLow = wind.leaves.filter((l) => l.active && l.mesh.visible).length
    const activeRibbonsLow = wind.ribbons.filter((r) => r.active && r.mesh.visible).length
    expect(activeLeavesLow).toBe(12)
    expect(activeRibbonsLow).toBe(2)

    // Switch back to high density
    settings.setParticleDensity('high')
    wind.applyDensity('high')

    const activeLeavesHigh = wind.leaves.filter((l) => l.active && l.mesh.visible).length
    const activeRibbonsHigh = wind.ribbons.filter((r) => r.active && r.mesh.visible).length
    expect(activeLeavesHigh).toBe(32)
    expect(activeRibbonsHigh).toBe(5)

    wind.dispose()
  })

  it('provides a normalized gust intensity between 0.0 and 1.0', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    for (let t = 0; t < 10; t += 0.2) {
      wind.update(0.2)
      const gust = wind.getGustIntensity()
      expect(gust).toBeGreaterThanOrEqual(0.0)
      expect(gust).toBeLessThanOrEqual(1.0)
    }

    wind.dispose()
  })

  it('cleans up geometries, materials, and children from scene on dispose()', () => {
    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    expect(scene.children).toContain(wind.group)
    wind.dispose()

    expect(scene.children).not.toContain(wind.group)
    expect(wind.group.children.length).toBe(0)
    expect(wind.leaves.length).toBe(0)
    expect(wind.ribbons.length).toBe(0)
  })
})
