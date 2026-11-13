import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { ArenaAmbientWind } from '../game/scenes/arena-ambient-wind'
import {
  createDustMoteTexture,
  createLeafGeometry,
  createLeafVeinTexture,
} from '../game/scenes/arena-ambient-wind.geometry'
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

  it('builds sculpted tropical leaf geometries with UVs, vertex colors, and protruding petiole', () => {
    const broad = createLeafGeometry('tropical-broad')
    const slender = createLeafGeometry('tropical-slender')

    for (const geo of [broad, slender]) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute
      const normal = geo.getAttribute('normal') as THREE.BufferAttribute
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute
      const color = geo.getAttribute('color') as THREE.BufferAttribute

      expect(pos).toBeDefined()
      expect(normal).toBeDefined()
      expect(uv).toBeDefined()
      expect(color).toBeDefined()
      expect(pos.count).toBeGreaterThan(40)

      geo.computeBoundingBox()
      const box = geo.boundingBox!
      // Should have positive Y depth (V-fold + arch + 3D midrib ridge) and length > width
      expect(box.max.y - box.min.y).toBeGreaterThan(0.03)
      expect(box.max.z - box.min.z).toBeGreaterThan(box.max.x - box.min.x)

      // Check vertex colors stay normalized in [0, 1] and vary between blade and midrib
      let minG = 1
      let maxG = 0
      for (let i = 0; i < color.count; i++) {
        const g = color.getY(i)
        minG = Math.min(minG, g)
        maxG = Math.max(maxG, g)
        expect(g).toBeGreaterThan(0)
        expect(g).toBeLessThanOrEqual(1)
      }
      expect(maxG - minG).toBeGreaterThan(0.05)

      geo.dispose()
    }

    broad.computeBoundingBox()
    slender.computeBoundingBox()
    const broadWidth = broad.boundingBox!.max.x - broad.boundingBox!.min.x
    const slenderWidth = slender.boundingBox!.max.x - slender.boundingBox!.min.x
    expect(broadWidth).toBeGreaterThan(slenderWidth)
  })

  it('generates procedural vein DataTexture and assigns lit materials + variants across leaves', () => {
    const veinTex = createLeafVeinTexture()
    expect(veinTex).toBeInstanceOf(THREE.DataTexture)
    expect(veinTex.image.width).toBe(128)
    expect(veinTex.image.height).toBe(128)
    expect(veinTex.version).toBeGreaterThan(0)
    expect((veinTex.image.data as Uint8Array).length).toBe(128 * 128 * 4)
    veinTex.dispose()

    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    const uniqueGeometries = new Set(wind.leaves.map((l) => l.mesh.geometry))
    expect(uniqueGeometries.size).toBe(2)

    const firstMat = wind.leaves[0]!.mesh.material as THREE.MeshLambertMaterial
    expect(firstMat).toBeInstanceOf(THREE.MeshLambertMaterial)
    expect(firstMat.vertexColors).toBe(true)
    expect(firstMat.map).toBeInstanceOf(THREE.DataTexture)

    wind.dispose()
  })

  it('initializes ambient floating dust motes, scales drawRange by density, and wraps on update()', () => {
    const dustTex = createDustMoteTexture()
    expect(dustTex).toBeInstanceOf(THREE.DataTexture)
    expect(dustTex.image.width).toBe(32)
    expect(dustTex.image.height).toBe(32)
    expect((dustTex.image.data as Uint8Array).length).toBe(32 * 32 * 4)
    dustTex.dispose()

    const scene = new THREE.Scene()
    const wind = new ArenaAmbientWind(scene)

    expect(wind.dustPoints).toBeInstanceOf(THREE.Points)
    expect(wind.group.children).toContain(wind.dustPoints)

    const posAttr = wind.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute
    expect(posAttr.count).toBe(120)
    expect(wind.dustPoints.geometry.drawRange.count).toBe(120)

    for (let i = 0; i < posAttr.count; i++) {
      expect(posAttr.getX(i)).toBeGreaterThanOrEqual(-24)
      expect(posAttr.getX(i)).toBeLessThanOrEqual(24)
      expect(posAttr.getY(i)).toBeGreaterThanOrEqual(0.15)
      expect(posAttr.getY(i)).toBeLessThanOrEqual(3.8)
      expect(posAttr.getZ(i)).toBeGreaterThanOrEqual(-38)
      expect(posAttr.getZ(i)).toBeLessThanOrEqual(38)
    }

    wind.applyDensity('low')
    expect(wind.dustPoints.geometry.drawRange.count).toBe(45)

    wind.applyDensity('high')
    expect(wind.dustPoints.geometry.drawRange.count).toBe(120)

    const initialX = posAttr.getX(0)
    // Force second mote past maxX to verify wrap-around
    posAttr.setXYZ(1, 30, 1.5, 0)

    wind.update(0.25)

    expect(posAttr.getX(0)).not.toBe(initialX)
    expect(posAttr.getX(1)).toBeGreaterThanOrEqual(-24)
    expect(posAttr.getX(1)).toBeLessThan(-15)

    wind.dispose()
  })
})
