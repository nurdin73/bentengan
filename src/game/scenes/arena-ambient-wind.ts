import * as THREE from 'three'
import { useSettingsStore } from '../../stores/settings-store'

export interface LeafParticle {
  mesh: THREE.Mesh
  active: boolean
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotationVelocity: THREE.Vector3
  swayPhase: number
  swayFrequency: number
  swayAmplitude: number
  baseScale: number
}

export interface WindRibbon {
  mesh: THREE.Mesh
  active: boolean
  cycleTime: number
  duration: number
  baseY: number
  startOffsetZ: number
  speed: number
  baseOpacity: number
}

export interface ArenaWindBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

const DEFAULT_ARENA_BOUNDS: ArenaWindBounds = {
  minX: -24,
  maxX: 24,
  minY: 0.4,
  maxY: 7.2,
  minZ: -38,
  maxZ: 38,
}

const LEAF_COLORS = [0x34d399, 0xa3e635, 0xfbbf24] as const

const MAX_LEAVES = 32
const LOW_DENSITY_LEAVES = 12
const MAX_RIBBONS = 5
const LOW_DENSITY_RIBBONS = 2

/**
 * Creates an organic multi-segment leaf geometry with a raised midrib spine,
 * asymmetric oval silhouette, pointed tip, and subtle lateral curvature.
 *
 * Layout (top-down, Z = forward):
 *   Tip (0) at front, Stem (6) at back, midrib raised along Y.
 *   Left lobes (1,3,5) and right lobes (2,4,6) curve outward with
 *   alternating Y offsets to produce a natural crease.
 *
 *        0  (tip)
 *       / \
 *      1   2     (upper lobes)
 *       \ /
 *      3   4     (widest mid lobes)
 *       \ /
 *      5   6     (lower lobes)
 *        |
 *        7  (stem)
 */
function createLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()

  // prettier-ignore
  const vertices = new Float32Array([
    //  x       y       z
     0.0,    0.06,  -0.30,  // 0  tip (pointed, slightly raised)
    -0.08,   0.02,  -0.16,  // 1  upper-left lobe
     0.09,   0.02,  -0.14,  // 2  upper-right lobe (asymmetric)
    -0.14,   0.00,   0.0,   // 3  mid-left lobe (widest)
     0.13,   0.01,   0.02,  // 4  mid-right lobe (slightly offset)
    -0.09,   0.01,   0.16,  // 5  lower-left lobe
     0.08,   0.00,   0.18,  // 6  lower-right lobe
     0.0,    0.04,   0.28,  // 7  stem base (raised midrib end)
  ])

  // prettier-ignore
  const indices = new Uint16Array([
    // Upper section
    0, 1, 2,
    // Mid-upper left & right
    1, 3, 4,   1, 4, 2,
    // Mid-lower left & right
    3, 5, 6,   3, 6, 4,
    // Lower section
    5, 7, 6,
  ])

  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()
  return geo
}

/**
 * Creates a tapered, curved ribbon strip geometry for wind streaks.
 */
function createRibbonGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const segments = 8
  const length = 7.5
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const z = (t - 0.5) * length
    // Gentle S-curve lateral offset
    const xOffset = Math.sin(t * Math.PI) * 0.8
    // Tapered width (narrow at ends, wider in middle)
    const halfWidth = Math.sin(t * Math.PI) * 0.14 + 0.02

    positions.push(xOffset - halfWidth, 0, z)
    positions.push(xOffset + halfWidth, 0, z)

    if (i < segments) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export class ArenaAmbientWind {
  public readonly group: THREE.Group
  private readonly scene: THREE.Scene
  private readonly bounds: ArenaWindBounds = { ...DEFAULT_ARENA_BOUNDS }

  // Shared Geometries & Materials
  private readonly leafGeo: THREE.BufferGeometry
  private readonly leafMaterials: THREE.MeshBasicMaterial[] = []
  private readonly ribbonGeo: THREE.BufferGeometry
  private readonly ribbonMat: THREE.MeshBasicMaterial

  // Pools
  public readonly leaves: LeafParticle[] = []
  public readonly ribbons: WindRibbon[] = []

  // Prevailing wind direction vector (normalized X and Z drift)
  private readonly windDirection = new THREE.Vector3(1.8, -0.08, 0.95)
  private gustIntensity = 0.2
  private gustTimer = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'ArenaAmbientWind_Root'
    this.scene.add(this.group)

    // Pre-allocate shared geometries
    this.leafGeo = createLeafGeometry()
    this.ribbonGeo = createRibbonGeometry()

    // Pre-allocate shared materials
    for (const color of LEAF_COLORS) {
      this.leafMaterials.push(
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      )
    }

    this.ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })

    this.initLeaves()
    this.initRibbons()
    this.applyDensity()
  }

  private initLeaves(): void {
    for (let i = 0; i < MAX_LEAVES; i++) {
      const mat = this.leafMaterials[i % this.leafMaterials.length]!
      const mesh = new THREE.Mesh(this.leafGeo, mat)
      mesh.name = `AmbientLeaf_${i}`

      const posX = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX)
      const posY = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY)
      const posZ = this.bounds.minZ + Math.random() * (this.bounds.maxZ - this.bounds.minZ)

      mesh.position.set(posX, posY, posZ)
      const scale = 0.9 + Math.random() * 0.5
      mesh.scale.setScalar(scale)
      this.group.add(mesh)

      this.leaves.push({
        mesh,
        active: true,
        position: mesh.position,
        velocity: new THREE.Vector3(
          this.windDirection.x * (0.8 + Math.random() * 0.4),
          this.windDirection.y * (0.8 + Math.random() * 0.4),
          this.windDirection.z * (0.8 + Math.random() * 0.4),
        ),
        rotationVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 2.8,
          (Math.random() - 0.5) * 2.2,
        ),
        swayPhase: Math.random() * Math.PI * 2,
        swayFrequency: 1.2 + Math.random() * 1.5,
        swayAmplitude: 0.25 + Math.random() * 0.35,
        baseScale: scale,
      })
    }
  }

  private initRibbons(): void {
    const heights = [2.2, 4.0, 5.8, 3.2, 4.8]
    const speeds = [12.0, 14.5, 11.0, 13.5, 15.0]

    for (let i = 0; i < MAX_RIBBONS; i++) {
      const mesh = new THREE.Mesh(this.ribbonGeo, this.ribbonMat)
      mesh.name = `WindRibbon_${i}`
      mesh.rotation.y = Math.atan2(this.windDirection.x, this.windDirection.z)
      this.group.add(mesh)

      const duration = 4.2 + (i % 3) * 0.8
      const cycleTime = (i / MAX_RIBBONS) * duration // Staggered start

      this.ribbons.push({
        mesh,
        active: true,
        cycleTime,
        duration,
        baseY: heights[i % heights.length]!,
        startOffsetZ: (Math.random() - 0.5) * 20,
        speed: speeds[i % speeds.length]!,
        baseOpacity: 0.22,
      })
    }
  }

  /**
   * Adjusts particle pool visibility based on settings particleDensity.
   */
  public applyDensity(forcedDensity?: 'low' | 'high'): void {
    let density: 'low' | 'high' = 'high'
    if (forcedDensity) {
      density = forcedDensity
    } else {
      try {
        density = useSettingsStore().particleDensity
      } catch {
        density = 'high'
      }
    }

    const activeLeavesCount = density === 'low' ? LOW_DENSITY_LEAVES : MAX_LEAVES
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i]!
      leaf.active = i < activeLeavesCount
      leaf.mesh.visible = leaf.active
    }

    const activeRibbonsCount = density === 'low' ? LOW_DENSITY_RIBBONS : MAX_RIBBONS
    for (let i = 0; i < this.ribbons.length; i++) {
      const ribbon = this.ribbons[i]!
      ribbon.active = i < activeRibbonsCount
      ribbon.mesh.visible = ribbon.active
    }
  }

  /**
   * Returns normalized gust intensity [0.0, 1.0] for audio synchronization.
   */
  public getGustIntensity(): number {
    return this.gustIntensity
  }

  /**
   * Zero allocation inside tick loop.
   */
  public update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return

    // Clamp dt to avoid huge leap on tab backgrounding
    const safeDt = Math.min(0.1, dt)

    // Modulate overall wind gust cycle (natural swell every ~6 seconds)
    this.gustTimer += safeDt
    const gustCycle = Math.sin(this.gustTimer * 1.05)
    this.gustIntensity = 0.25 + 0.35 * Math.max(0, gustCycle)

    this.updateLeaves(safeDt)
    this.updateRibbons(safeDt)
  }

  private updateLeaves(dt: number): void {
    const gustFactor = 1.0 + this.gustIntensity * 0.8

    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i]!
      if (!leaf.active) continue

      leaf.swayPhase += leaf.swayFrequency * dt
      const swayOffset = Math.sin(leaf.swayPhase) * leaf.swayAmplitude

      // Advance position along wind vector
      leaf.position.x += (leaf.velocity.x * gustFactor + swayOffset * 0.4) * dt
      leaf.position.y += (leaf.velocity.y - 0.12) * dt // Slow gentle sink
      leaf.position.z += (leaf.velocity.z * gustFactor + swayOffset * 0.2) * dt

      // Advance rotation tumbling
      leaf.mesh.rotation.x += leaf.rotationVelocity.x * dt
      leaf.mesh.rotation.y += leaf.rotationVelocity.y * dt
      leaf.mesh.rotation.z += leaf.rotationVelocity.z * dt

      // Seamless wrap-around when leaving arena bounds
      if (
        leaf.position.x > this.bounds.maxX ||
        leaf.position.z > this.bounds.maxZ ||
        leaf.position.y < this.bounds.minY
      ) {
        // Reset to upwind boundary
        leaf.position.x = this.bounds.minX + Math.random() * 4.0
        leaf.position.y = this.bounds.maxY - Math.random() * 2.5
        leaf.position.z = this.bounds.minZ + Math.random() * (this.bounds.maxZ - this.bounds.minZ)
      } else if (leaf.position.x < this.bounds.minX) {
        leaf.position.x = this.bounds.maxX
      }
    }
  }

  private updateRibbons(dt: number): void {
    const totalDistX = this.bounds.maxX - this.bounds.minX + 16

    for (let i = 0; i < this.ribbons.length; i++) {
      const ribbon = this.ribbons[i]!
      if (!ribbon.active) continue

      ribbon.cycleTime += dt
      if (ribbon.cycleTime >= ribbon.duration) {
        ribbon.cycleTime = 0
        ribbon.startOffsetZ = (Math.random() - 0.5) * 36
      }

      const progress = ribbon.cycleTime / ribbon.duration
      // Position moves from minX - 8 to maxX + 8
      const currentX = this.bounds.minX - 8 + progress * totalDistX
      // Z follows diagonal slope
      const currentZ = ribbon.startOffsetZ + progress * 24
      // Y undulates smoothly
      const currentY = ribbon.baseY + Math.sin(progress * Math.PI * 2) * 0.4

      ribbon.mesh.position.set(currentX, currentY, currentZ)

      // Fade-in at start, fade-out at end of streak
      let alpha = 1.0
      if (progress < 0.2) {
        alpha = progress / 0.2
      } else if (progress > 0.75) {
        alpha = (1.0 - progress) / 0.25
      }

      const mat = ribbon.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = ribbon.baseOpacity * alpha * (0.8 + this.gustIntensity * 0.6)
    }
  }

  public dispose(): void {
    this.scene.remove(this.group)
    this.leafGeo.dispose()
    this.ribbonGeo.dispose()
    for (const mat of this.leafMaterials) {
      mat.dispose()
    }
    this.ribbonMat.dispose()
    this.group.clear()
    this.leaves.length = 0
    this.ribbons.length = 0
  }
}
