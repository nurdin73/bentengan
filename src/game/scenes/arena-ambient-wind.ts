import * as THREE from 'three'
import { useSettingsStore } from '../../stores/settings-store'
import {
  createDustMoteTexture,
  createLeafGeometry,
  createLeafVeinTexture,
  createRibbonGeometry,
  type LeafShapeVariant,
} from './arena-ambient-wind.geometry'

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

export interface ArenaAmbientWindOptions {
  initialAngleRad?: number
  enableDynamicShift?: boolean
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
const LEAF_VARIANTS: readonly LeafShapeVariant[] = ['tropical-broad', 'tropical-slender']
const DUST_COLORS = [0xe7d3b0, 0xd9b77e, 0xf3e5cc] as const

const MAX_LEAVES = 32
const LOW_DENSITY_LEAVES = 12
const MAX_RIBBONS = 5
const LOW_DENSITY_RIBBONS = 2
const MAX_DUST_MOTES = 120
const LOW_DENSITY_DUST_MOTES = 45
const DUST_MIN_Y = 0.15
const DUST_MAX_Y = 3.8
const DEFAULT_WIND_SPEED = 2.04
const WIND_SINK_Y = -0.08
const WIND_SHIFT_RATE_RAD = 0.16
const RIBBON_HALF_SPAN = 36
const RIBBON_LATERAL_SPREAD = 22
const TWO_PI = Math.PI * 2

function normalizeAngle(angleRad: number): number {
  const wrapped = angleRad % TWO_PI
  return wrapped < 0 ? wrapped + TWO_PI : wrapped
}

export class ArenaAmbientWind {
  public readonly group: THREE.Group
  private readonly scene: THREE.Scene
  private readonly bounds: ArenaWindBounds = { ...DEFAULT_ARENA_BOUNDS }

  // Shared Geometries, Textures & Materials
  private readonly leafGeometries: THREE.BufferGeometry[] = []
  private readonly leafVeinTexture: THREE.DataTexture
  private readonly leafMaterials: THREE.MeshLambertMaterial[] = []
  private readonly ribbonGeo: THREE.BufferGeometry
  private readonly ribbonMat: THREE.MeshBasicMaterial
  private readonly dustGeo: THREE.BufferGeometry
  private readonly dustTexture: THREE.DataTexture
  private readonly dustMat: THREE.PointsMaterial

  // Pools
  public readonly leaves: LeafParticle[] = []
  public readonly ribbons: WindRibbon[] = []
  public readonly dustPoints: THREE.Points
  private readonly leafSpeedMultipliers = new Float32Array(MAX_LEAVES)
  private readonly dustSpeedMultipliers = new Float32Array(MAX_DUST_MOTES)
  private readonly dustPhases = new Float32Array(MAX_DUST_MOTES)
  private activeDustCount = MAX_DUST_MOTES

  // Dynamic wind direction & gust state
  private readonly windDirection = new THREE.Vector3(DEFAULT_WIND_SPEED, WIND_SINK_Y, 0)
  private windAngle: number
  private targetWindAngle: number
  private readonly enableDynamicShift: boolean
  private windShiftTimer = 0
  private windShiftInterval: number
  private gustIntensity = 0.2
  private gustTimer = 0

  constructor(scene: THREE.Scene, options: ArenaAmbientWindOptions = {}) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'ArenaAmbientWind_Root'
    this.scene.add(this.group)

    const initialAngle =
      options.initialAngleRad !== undefined && Number.isFinite(options.initialAngleRad)
        ? normalizeAngle(options.initialAngleRad)
        : Math.random() * TWO_PI
    this.windAngle = initialAngle
    this.targetWindAngle = initialAngle
    this.enableDynamicShift = options.enableDynamicShift ?? true
    this.windShiftInterval = 12 + Math.random() * 6
    this.syncWindDirection()

    // Pre-allocate shared geometries & vein texture
    for (const variant of LEAF_VARIANTS) {
      this.leafGeometries.push(createLeafGeometry(variant))
    }
    this.leafVeinTexture = createLeafVeinTexture()
    this.ribbonGeo = createRibbonGeometry()

    // Pre-allocate shared materials (lit Lambert + vertexColors so 3D V-fold & midrib catch light)
    for (const color of LEAF_COLORS) {
      this.leafMaterials.push(
        new THREE.MeshLambertMaterial({
          color,
          map: this.leafVeinTexture,
          vertexColors: true,
          emissive: color,
          emissiveIntensity: 0.16,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.94,
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

    this.dustTexture = createDustMoteTexture()
    this.dustGeo = new THREE.BufferGeometry()
    this.dustMat = new THREE.PointsMaterial({
      size: 0.16,
      map: this.dustTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.dustPoints = new THREE.Points(this.dustGeo, this.dustMat)
    this.dustPoints.name = 'AmbientDustMotes'
    this.group.add(this.dustPoints)

    this.initLeaves()
    this.initRibbons()
    this.initDustMotes()
    this.applyDensity()
  }

  private initLeaves(): void {
    for (let i = 0; i < MAX_LEAVES; i++) {
      const geo = this.leafGeometries[i % this.leafGeometries.length]!
      const mat = this.leafMaterials[i % this.leafMaterials.length]!
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = `AmbientLeaf_${i}`

      const posX = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX)
      const posY = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY)
      const posZ = this.bounds.minZ + Math.random() * (this.bounds.maxZ - this.bounds.minZ)

      mesh.position.set(posX, posY, posZ)
      const scale = 0.95 + Math.random() * 0.55
      mesh.scale.setScalar(scale)
      this.group.add(mesh)

      const speedMult = 0.8 + Math.random() * 0.4
      this.leafSpeedMultipliers[i] = speedMult

      this.leaves.push({
        mesh,
        active: true,
        position: mesh.position,
        velocity: new THREE.Vector3(
          this.windDirection.x * speedMult,
          this.windDirection.y * speedMult,
          this.windDirection.z * speedMult,
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
        startOffsetZ: (Math.random() - 0.5) * RIBBON_LATERAL_SPREAD * 2,
        speed: speeds[i % speeds.length]!,
        baseOpacity: 0.22,
      })
    }
  }

  private initDustMotes(): void {
    const positions = new Float32Array(MAX_DUST_MOTES * 3)
    const colors = new Float32Array(MAX_DUST_MOTES * 3)
    const colorHelper = new THREE.Color()

    for (let i = 0; i < MAX_DUST_MOTES; i++) {
      const idx = i * 3
      positions[idx] = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX)
      positions[idx + 1] = DUST_MIN_Y + Math.random() * (DUST_MAX_Y - DUST_MIN_Y)
      positions[idx + 2] = this.bounds.minZ + Math.random() * (this.bounds.maxZ - this.bounds.minZ)

      colorHelper.setHex(DUST_COLORS[i % DUST_COLORS.length]!)
      colors[idx] = colorHelper.r
      colors[idx + 1] = colorHelper.g
      colors[idx + 2] = colorHelper.b

      this.dustSpeedMultipliers[i] = 0.75 + Math.random() * 0.7
      this.dustPhases[i] = Math.random() * Math.PI * 2
    }

    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dustGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.dustGeo.setDrawRange(0, MAX_DUST_MOTES)
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

    this.activeDustCount = density === 'low' ? LOW_DENSITY_DUST_MOTES : MAX_DUST_MOTES
    this.dustGeo.setDrawRange(0, this.activeDustCount)
  }

  /**
   * Returns normalized gust intensity [0.0, 1.0] for audio synchronization.
   */
  public getGustIntensity(): number {
    return this.gustIntensity
  }

  /**
   * Returns current horizontal wind direction angle in radians [0, 2π).
   */
  public getWindAngle(): number {
    return this.windAngle
  }

  private syncWindDirection(): void {
    this.windDirection.set(
      Math.cos(this.windAngle) * DEFAULT_WIND_SPEED,
      WIND_SINK_Y,
      Math.sin(this.windAngle) * DEFAULT_WIND_SPEED,
    )
  }

  private wrapCoordinate(value: number, min: number, max: number): number {
    if (value > max) return min + Math.random() * 3.0
    if (value < min) return max - Math.random() * 3.0
    return value
  }

  private updateWindAngle(dt: number): void {
    if (!this.enableDynamicShift) return

    this.windShiftTimer += dt
    if (this.windShiftTimer >= this.windShiftInterval) {
      this.windShiftTimer = 0
      this.windShiftInterval = 12 + Math.random() * 6
      const shiftSign = Math.random() < 0.5 ? -1 : 1
      const shiftDelta = 0.4 + Math.random() * 0.6
      this.targetWindAngle = normalizeAngle(this.windAngle + shiftSign * shiftDelta)
    }

    const diff = Math.atan2(
      Math.sin(this.targetWindAngle - this.windAngle),
      Math.cos(this.targetWindAngle - this.windAngle),
    )
    if (Math.abs(diff) > 1e-4) {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), WIND_SHIFT_RATE_RAD * dt)
      this.windAngle = normalizeAngle(this.windAngle + step)
      this.syncWindDirection()
    }
  }

  /**
   * Zero allocation inside tick loop.
   */
  public update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return

    // Clamp dt to avoid huge leap on tab backgrounding
    const safeDt = Math.min(0.1, dt)

    this.updateWindAngle(safeDt)

    // Modulate overall wind gust cycle (natural swell every ~6 seconds)
    this.gustTimer += safeDt
    const gustCycle = Math.sin(this.gustTimer * 1.05)
    this.gustIntensity = 0.25 + 0.35 * Math.max(0, gustCycle)

    this.updateLeaves(safeDt)
    this.updateRibbons(safeDt)
    this.updateDustMotes(safeDt)
  }

  private updateLeaves(dt: number): void {
    const gustFactor = 1.0 + this.gustIntensity * 0.8

    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i]!
      if (!leaf.active) continue

      const speedMult = this.leafSpeedMultipliers[i]!
      leaf.velocity.set(
        this.windDirection.x * speedMult,
        this.windDirection.y * speedMult,
        this.windDirection.z * speedMult,
      )

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

      // Symmetric 4-sided wrap-around when leaving arena bounds
      leaf.position.x = this.wrapCoordinate(leaf.position.x, this.bounds.minX, this.bounds.maxX)
      leaf.position.z = this.wrapCoordinate(leaf.position.z, this.bounds.minZ, this.bounds.maxZ)
      if (leaf.position.y < this.bounds.minY) {
        leaf.position.y = this.bounds.maxY - Math.random() * 2.5
      }
    }
  }

  private updateRibbons(dt: number): void {
    const dirX = Math.cos(this.windAngle)
    const dirZ = Math.sin(this.windAngle)
    const perpX = -dirZ
    const perpZ = dirX
    const ribbonYaw = Math.atan2(dirX, dirZ)

    for (let i = 0; i < this.ribbons.length; i++) {
      const ribbon = this.ribbons[i]!
      if (!ribbon.active) continue

      ribbon.cycleTime += dt
      if (ribbon.cycleTime >= ribbon.duration) {
        ribbon.cycleTime = 0
        ribbon.startOffsetZ = (Math.random() - 0.5) * RIBBON_LATERAL_SPREAD * 2
      }

      const progress = ribbon.cycleTime / ribbon.duration
      const along = (progress - 0.5) * RIBBON_HALF_SPAN * 2
      const currentX = along * dirX + ribbon.startOffsetZ * perpX
      const currentZ = along * dirZ + ribbon.startOffsetZ * perpZ
      const currentY = ribbon.baseY + Math.sin(progress * Math.PI * 2) * 0.4

      ribbon.mesh.position.set(currentX, currentY, currentZ)
      ribbon.mesh.rotation.y = ribbonYaw

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

  private updateDustMotes(dt: number): void {
    const posAttr = this.dustGeo.getAttribute('position') as THREE.BufferAttribute
    const positions = posAttr.array as Float32Array
    const gustFactor = 1.15 + this.gustIntensity * 1.1

    for (let i = 0; i < this.activeDustCount; i++) {
      const idx = i * 3
      const speedMult = this.dustSpeedMultipliers[i]!
      const phase = this.dustPhases[i]! + dt * 1.6
      this.dustPhases[i] = phase

      const rawX = positions[idx]! + this.windDirection.x * gustFactor * speedMult * dt
      let y = positions[idx + 1]! + Math.sin(phase) * 0.09 * dt
      const rawZ = positions[idx + 2]! + this.windDirection.z * gustFactor * speedMult * dt

      const x = this.wrapCoordinate(rawX, this.bounds.minX, this.bounds.maxX)
      const z = this.wrapCoordinate(rawZ, this.bounds.minZ, this.bounds.maxZ)
      if (y < DUST_MIN_Y) {
        y = DUST_MAX_Y
      } else if (y > DUST_MAX_Y) {
        y = DUST_MIN_Y
      }

      positions[idx] = x
      positions[idx + 1] = y
      positions[idx + 2] = z
    }

    posAttr.needsUpdate = true
    this.dustMat.opacity = 0.28 + this.gustIntensity * 0.2
  }

  public dispose(): void {
    this.scene.remove(this.group)
    for (const geo of this.leafGeometries) {
      geo.dispose()
    }
    this.leafVeinTexture.dispose()
    this.ribbonGeo.dispose()
    this.dustGeo.dispose()
    this.dustTexture.dispose()
    for (const mat of this.leafMaterials) {
      mat.dispose()
    }
    this.ribbonMat.dispose()
    this.dustMat.dispose()
    this.group.clear()
    this.leaves.length = 0
    this.ribbons.length = 0
  }
}
