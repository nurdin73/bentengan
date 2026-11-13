import * as THREE from 'three'
import { GAME_CONFIG } from '../core/constants'
import { useSettingsStore } from '../../stores/settings-store'
import type { DashGhost, Particle, ShockwaveRing, SpeedLine, Vector3Position } from './vfx-types'

export type { Vector3Position } from './vfx-types'

function isValidPos(pos: Vector3Position): boolean {
  return Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)
}

export class VFXManager {
  private readonly scene: THREE.Scene
  public readonly group: THREE.Group

  // Dust particles pool
  private readonly dustPool: Particle[] = []
  private readonly dustGeo: THREE.DodecahedronGeometry
  private readonly dustMat: THREE.MeshBasicMaterial

  // Sparkles pool (rescue)
  private readonly sparklePool: Particle[] = []
  private readonly sparkleGeo: THREE.OctahedronGeometry
  private readonly sparkleMat: THREE.MeshBasicMaterial

  // Shockwave rings pool (capture / base touch / smoke burst)
  private readonly ringPool: ShockwaveRing[] = []
  private readonly ringGeo: THREE.RingGeometry
  private readonly ringMat: THREE.MeshBasicMaterial

  // Dash afterimage trail pool
  private readonly dashPool: DashGhost[] = []
  private readonly dashGeo: THREE.BoxGeometry
  private readonly dashMat: THREE.MeshBasicMaterial

  // Adrenaline rising aura motes pool
  private readonly auraPool: Particle[] = []
  private readonly auraGeo: THREE.TetrahedronGeometry
  private readonly auraMat: THREE.MeshBasicMaterial

  // Tag hit-spark pool
  private readonly hitSparkPool: Particle[] = []
  private readonly hitSparkGeo: THREE.OctahedronGeometry
  private readonly hitSparkMat: THREE.MeshBasicMaterial

  // Sprint / Dash speed-lines pool
  private readonly speedLinePool: SpeedLine[] = []
  private readonly speedLineGeo: THREE.BoxGeometry
  private readonly speedLineMat: THREE.MeshBasicMaterial

  // Beacon beam (base captured)
  private readonly beaconMesh: THREE.Mesh
  private beaconActive = false
  private beaconTimer = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'VFXGroup'
    this.scene.add(this.group)

    // 1. Dust Pool Initialization (Pre-allocated 24 particles)
    this.dustGeo = new THREE.DodecahedronGeometry(0.12, 0)
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xd4c5b9,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    this.populateParticlePool(this.dustPool, 24, this.dustGeo, this.dustMat, {
      maxLifetime: 0.45,
      initialScale: 0.8,
      scaleMultiplier: 2.2,
      baseOpacity: 0.6,
    })

    // 2. Sparkles Pool Initialization (Pre-allocated 32 particles)
    this.sparkleGeo = new THREE.OctahedronGeometry(0.14, 0)
    this.sparkleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    this.populateParticlePool(this.sparklePool, 32, this.sparkleGeo, this.sparkleMat, {
      maxLifetime: 0.6,
      initialScale: 1.0,
      scaleMultiplier: -0.7,
      gravity: 4.0,
      baseOpacity: 0.95,
    })

    // 3. Shockwave Rings Pool (Pre-allocated 8 rings)
    this.ringGeo = new THREE.RingGeometry(0.3, 0.45, 24)
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone())
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      this.group.add(mesh)
      this.ringPool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: 0.4,
        startScale: 0.5,
        targetScale: 3.5,
        baseOpacity: 0.85,
      })
    }

    // 4. Dash Afterimage Trail Pool (Pre-allocated 12 ghosts)
    this.dashGeo = new THREE.BoxGeometry(0.55, 1.05, 0.35)
    this.dashMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(this.dashGeo, this.dashMat.clone())
      mesh.visible = false
      this.group.add(mesh)
      this.dashPool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: 0.26,
      })
    }

    // 5. Adrenaline Aura Motes Pool (Pre-allocated 24 motes)
    this.auraGeo = new THREE.TetrahedronGeometry(0.12, 0)
    this.auraMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
    this.populateParticlePool(this.auraPool, 24, this.auraGeo, this.auraMat, {
      maxLifetime: 0.55,
      initialScale: 1.05,
      scaleMultiplier: -0.6,
      gravity: -1.6,
      baseOpacity: 0.92,
    })

    // 6. Tag Hit-Spark Pool (Pre-allocated 24 sparks)
    this.hitSparkGeo = new THREE.OctahedronGeometry(0.11, 0)
    this.hitSparkMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    this.populateParticlePool(this.hitSparkPool, 24, this.hitSparkGeo, this.hitSparkMat, {
      maxLifetime: 0.32,
      initialScale: 1.1,
      scaleMultiplier: -0.9,
      gravity: 6.5,
      baseOpacity: 0.95,
    })

    // 7. Speed-Lines Pool (Pre-allocated 18 streaks)
    this.speedLineGeo = new THREE.BoxGeometry(0.035, 0.035, 0.85)
    this.speedLineMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(this.speedLineGeo, this.speedLineMat.clone())
      mesh.visible = false
      this.group.add(mesh)
      this.speedLinePool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: 0.22,
        velocity: new THREE.Vector3(),
      })
    }

    // 8. Base Touch Beacon Cylinder
    const beaconGeo = new THREE.CylinderGeometry(0.8, 0.8, 25, 16, 1, true)
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat)
    this.beaconMesh.position.set(0, 12.5, 0)
    this.beaconMesh.visible = false
    this.group.add(this.beaconMesh)
  }

  private populateParticlePool(
    pool: Particle[],
    count: number,
    geo: THREE.BufferGeometry,
    baseMat: THREE.MeshBasicMaterial,
    defaults: {
      maxLifetime: number
      initialScale: number
      scaleMultiplier: number
      gravity?: number
      baseOpacity: number
    },
  ): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, baseMat.clone())
      mesh.visible = false
      this.group.add(mesh)
      pool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: defaults.maxLifetime,
        velocity: new THREE.Vector3(),
        initialScale: defaults.initialScale,
        scaleMultiplier: defaults.scaleMultiplier,
        gravity: defaults.gravity ?? 0,
        baseOpacity: defaults.baseOpacity,
      })
    }
  }

  private isHighDensity(): boolean {
    try {
      const settings = useSettingsStore()
      return settings.particleDensity === 'high'
    } catch {
      return true
    }
  }

  private getFootY(pos: Vector3Position, isCenterOrigin: boolean): number {
    if (!isCenterOrigin) return pos.y
    return pos.y - GAME_CONFIG.movement.characterHeight / 2
  }

  /**
   * Spawns a dust puff at the given position (e.g., player foot when sprinting).
   */
  public spawnSprintDust(pos: Vector3Position, isCenterOrigin = true): void {
    if (!isValidPos(pos)) return
    if (!this.isHighDensity() && Math.random() < 0.5) return

    const particle = this.dustPool.find((p) => !p.active)
    if (!particle) return

    particle.active = true
    particle.lifetime = 0
    particle.maxLifetime = 0.35 + Math.random() * 0.15
    particle.initialScale = 0.8
    particle.scaleMultiplier = 2.2
    particle.baseOpacity = 0.6
    particle.gravity = 0

    const footY = this.getFootY(pos, isCenterOrigin)
    particle.mesh.position.set(
      pos.x + (Math.random() * 0.3 - 0.15),
      footY + 0.06,
      pos.z + (Math.random() * 0.3 - 0.15),
    )
    particle.velocity.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * 0.6 + 0.2,
      (Math.random() - 0.5) * 0.4,
    )
    particle.mesh.scale.setScalar(particle.initialScale)
    const mat = particle.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(0xd4c5b9)
    mat.opacity = 0.55
    particle.mesh.visible = true
  }

  /**
   * Spawns radial foot-level dust puffs on jump takeoff or landing impact.
   */
  public spawnJumpLandDust(pos: Vector3Position, intensity = 1.0, isCenterOrigin = true): void {
    if (!isValidPos(pos)) return
    const count = this.isHighDensity() ? 8 : 4
    const footY = this.getFootY(pos, isCenterOrigin)
    let spawned = 0

    for (const particle of this.dustPool) {
      if (particle.active) continue

      const angle = (spawned / count) * Math.PI * 2 + Math.random() * 0.35
      const radialSpeed = (1.3 + Math.random() * 0.8) * intensity

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.32 + Math.random() * 0.12
      particle.initialScale = 0.75 * Math.min(1.4, intensity)
      particle.scaleMultiplier = 1.9
      particle.baseOpacity = 0.62
      particle.gravity = 0.6

      particle.mesh.position.set(
        pos.x + Math.cos(angle) * 0.22,
        footY + 0.06,
        pos.z + Math.sin(angle) * 0.22,
      )
      particle.velocity.set(
        Math.cos(angle) * radialSpeed,
        0.35 + Math.random() * 0.35,
        Math.sin(angle) * radialSpeed,
      )
      particle.mesh.scale.setScalar(particle.initialScale)
      const mat = particle.mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(0xd4c5b9)
      mat.opacity = 0.6
      particle.mesh.visible = true

      spawned++
      if (spawned >= count) break
    }
  }

  /**
   * Spawns an expanding shockwave ring on tag capture or impact.
   */
  public spawnCaptureRing(pos: Vector3Position, color: number = 0xf59e0b): void {
    if (!isValidPos(pos)) return
    const ring = this.ringPool.find((r) => !r.active)
    if (!ring) return

    ring.active = true
    ring.lifetime = 0
    ring.maxLifetime = 0.42
    ring.startScale = 0.4
    ring.targetScale = 3.2
    ring.baseOpacity = 0.85
    ring.mesh.position.set(pos.x, pos.y + 0.15, pos.z)
    ring.mesh.scale.setScalar(ring.startScale)
    const mat = ring.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.9
    ring.mesh.visible = true
  }

  /**
   * Spawns a crisp directional hit-spark burst + impact ring on tag/capture or stun.
   */
  public spawnTagHitSpark(pos: Vector3Position, color: number = 0xfef08a): void {
    if (!isValidPos(pos)) return
    const count = this.isHighDensity() ? 12 : 6
    let spawned = 0

    for (const particle of this.hitSparkPool) {
      if (particle.active) continue

      const angle = Math.random() * Math.PI * 2
      const speed = 2.6 + Math.random() * 2.4

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.24 + Math.random() * 0.12
      particle.initialScale = 1.1
      particle.scaleMultiplier = -0.9
      particle.gravity = 6.5
      particle.baseOpacity = 0.95

      particle.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.2,
        pos.y + 0.65 + (Math.random() - 0.5) * 0.3,
        pos.z + (Math.random() - 0.5) * 0.2,
      )
      particle.velocity.set(
        Math.cos(angle) * speed,
        1.8 + Math.random() * 2.2,
        Math.sin(angle) * speed,
      )
      particle.mesh.scale.setScalar(particle.initialScale)
      const mat = particle.mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(color)
      mat.opacity = 0.95
      particle.mesh.visible = true

      spawned++
      if (spawned >= count) break
    }

    this.spawnCaptureRing(pos, color)
  }

  /**
   * Spawns a translucent afterimage silhouette during active Dash skill.
   */
  public spawnDashTrail(pos: Vector3Position, rotationY: number, color: number = 0x38bdf8): void {
    if (!isValidPos(pos)) return
    if (!this.isHighDensity() && Math.random() < 0.4) return

    const ghost = this.dashPool.find((g) => !g.active)
    if (!ghost) return

    ghost.active = true
    ghost.lifetime = 0
    ghost.maxLifetime = 0.26
    ghost.mesh.position.set(pos.x, pos.y, pos.z)
    ghost.mesh.rotation.set(0.18, Number.isFinite(rotationY) ? rotationY : 0, 0)
    ghost.mesh.scale.set(0.95, 0.95, 0.95)
    const mat = ghost.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.55
    ghost.mesh.visible = true
  }

  /**
   * Spawns rising energy motes around an entity while Adrenaline skill is active.
   */
  public spawnAdrenalineAura(pos: Vector3Position, color: number = 0xfbbf24): void {
    if (!isValidPos(pos)) return
    const count = this.isHighDensity() ? 3 : 1
    let spawned = 0

    for (const particle of this.auraPool) {
      if (particle.active) continue

      const angle = Math.random() * Math.PI * 2
      const radius = 0.35 + Math.random() * 0.35

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.48 + Math.random() * 0.2
      particle.initialScale = 1.05
      particle.scaleMultiplier = -0.65
      particle.gravity = -1.6
      particle.baseOpacity = 0.92

      particle.mesh.position.set(
        pos.x + Math.cos(angle) * radius,
        pos.y - 0.35 + Math.random() * 0.4,
        pos.z + Math.sin(angle) * radius,
      )
      particle.velocity.set(Math.cos(angle) * 0.4, 1.8 + Math.random() * 1.1, Math.sin(angle) * 0.4)
      particle.mesh.scale.setScalar(particle.initialScale)
      const mat = particle.mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(color)
      mat.opacity = 0.92
      particle.mesh.visible = true

      spawned++
      if (spawned >= count) break
    }
  }

  /**
   * Spawns an initial radial detonation ring and puff burst when Smoke skill is triggered.
   */
  public spawnSmokeBurst(
    pos: Vector3Position,
    radius: number = GAME_CONFIG.skills.smoke.radius,
    color: number = 0x94a3b8,
  ): void {
    if (!isValidPos(pos)) return
    const ring = this.ringPool.find((r) => !r.active)
    if (ring) {
      ring.active = true
      ring.lifetime = 0
      ring.maxLifetime = 0.45
      ring.startScale = 0.6
      ring.targetScale = Math.max(3.5, radius * 1.45)
      ring.baseOpacity = 0.75
      ring.mesh.position.set(pos.x, pos.y + 0.12, pos.z)
      ring.mesh.scale.setScalar(ring.startScale)
      const mat = ring.mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(color)
      mat.opacity = 0.75
      ring.mesh.visible = true
    }

    const puffCount = this.isHighDensity() ? 10 : 5
    let spawned = 0
    for (const particle of this.dustPool) {
      if (particle.active) continue

      const angle = (spawned / puffCount) * Math.PI * 2
      const speed = 2.8 + Math.random() * 1.6

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.42 + Math.random() * 0.14
      particle.initialScale = 1.2
      particle.scaleMultiplier = 2.6
      particle.baseOpacity = 0.65
      particle.gravity = -0.3

      particle.mesh.position.set(pos.x, pos.y + 0.25, pos.z)
      particle.velocity.set(
        Math.cos(angle) * speed,
        0.5 + Math.random() * 0.6,
        Math.sin(angle) * speed,
      )
      particle.mesh.scale.setScalar(particle.initialScale)
      const mat = particle.mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(color)
      mat.opacity = 0.65
      particle.mesh.visible = true

      spawned++
      if (spawned >= puffCount) break
    }
  }

  /**
   * Spawns a directional speed-line streak near a fast-moving local player.
   */
  public spawnSpeedLine(pos: Vector3Position, rotationY: number, color: number = 0xe0f2fe): void {
    if (!isValidPos(pos)) return
    if (!this.isHighDensity() && Math.random() < 0.5) return

    const line = this.speedLinePool.find((l) => !l.active)
    if (!line) return

    const yaw = Number.isFinite(rotationY) ? rotationY : 0
    const sideOffset = (Math.random() - 0.5) * 1.4
    const heightOffset = -0.25 + Math.random() * 1.15
    const dirX = Math.sin(yaw)
    const dirZ = Math.cos(yaw)
    const perpX = Math.cos(yaw)
    const perpZ = -Math.sin(yaw)

    line.active = true
    line.lifetime = 0
    line.maxLifetime = 0.18 + Math.random() * 0.08
    line.mesh.position.set(
      pos.x + perpX * sideOffset + dirX * 0.4,
      pos.y + heightOffset,
      pos.z + perpZ * sideOffset + dirZ * 0.4,
    )
    line.mesh.rotation.set(0, yaw, 0)
    line.velocity.set(-dirX * 5.5, 0, -dirZ * 5.5)

    const mat = line.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.55
    line.mesh.visible = true
  }

  /**
   * Spawns sparkling burst when a player is rescued from jail.
   */
  public spawnRescueSparkles(pos: Vector3Position): void {
    if (!isValidPos(pos)) return
    const count = this.isHighDensity() ? 16 : 8
    let spawned = 0

    for (const particle of this.sparklePool) {
      if (particle.active) continue

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.5 + Math.random() * 0.2
      particle.initialScale = 1.0
      particle.scaleMultiplier = -0.7
      particle.gravity = 4.0
      particle.baseOpacity = 0.95

      particle.mesh.position.set(
        pos.x + (Math.random() * 0.4 - 0.2),
        pos.y + 0.4 + Math.random() * 0.5,
        pos.z + (Math.random() * 0.4 - 0.2),
      )

      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 2.2 + 1.2
      particle.velocity.set(
        Math.cos(angle) * speed * 0.5,
        Math.random() * 2.5 + 1.5,
        Math.sin(angle) * speed * 0.5,
      )
      particle.mesh.scale.setScalar(0.9)
      ;(particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95
      particle.mesh.visible = true

      spawned++
      if (spawned >= count) break
    }

    // Also trigger a cyan rescue wave
    this.spawnCaptureRing(pos, 0x06b6d4)
  }

  /**
   * Spawns a subtle pulsing shimmer on the jail zone floor to clearly indicate prisoner boundaries.
   */
  public spawnPrisonerShimmer(pos: Vector3Position, color: number = 0x38bdf8): void {
    if (!isValidPos(pos)) return
    const ring = this.ringPool.find((r) => !r.active)
    if (!ring) return

    ring.active = true
    ring.lifetime = 0
    ring.maxLifetime = 0.85
    ring.startScale = 2.0
    ring.targetScale = 3.6
    ring.baseOpacity = 0.45
    ring.mesh.position.set(pos.x, 0.05, pos.z)
    ring.mesh.scale.setScalar(ring.startScale)
    const mat = ring.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.45
    ring.mesh.visible = true
  }

  /**
   * Triggers a vertical light beacon when base pillar is touched.
   */
  public triggerBaseBeacon(pos: Vector3Position, color: number = 0xfacc15): void {
    if (!isValidPos(pos)) return
    this.beaconActive = true
    this.beaconTimer = 2.0
    this.beaconMesh.position.set(pos.x, 12.5, pos.z)
    const mat = this.beaconMesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.75
    this.beaconMesh.visible = true

    // Large ring ripple
    this.spawnCaptureRing(pos, color)
  }

  /**
   * Frame-by-frame update loop (Zero allocation inside tick).
   */
  public update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    this.updateParticlePool(this.dustPool, dt)
    this.updateParticlePool(this.sparklePool, dt)
    this.updateParticlePool(this.auraPool, dt)
    this.updateParticlePool(this.hitSparkPool, dt)
    this.updateRingPool(dt)
    this.updateDashPool(dt)
    this.updateSpeedLinePool(dt)
    this.updateBeacon(dt)
  }

  private updateParticlePool(pool: Particle[], dt: number): void {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      if (!p || !p.active) continue

      p.lifetime += dt
      if (p.lifetime >= p.maxLifetime) {
        p.active = false
        p.mesh.visible = false
        continue
      }

      const progress = p.lifetime / p.maxLifetime
      if (p.gravity) {
        p.velocity.y -= p.gravity * dt
      }
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt

      const curScale = Math.max(0.05, p.initialScale + progress * p.scaleMultiplier)
      p.mesh.scale.setScalar(curScale)

      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * (p.baseOpacity ?? 0.8)
    }
  }

  private updateRingPool(dt: number): void {
    for (let i = 0; i < this.ringPool.length; i++) {
      const r = this.ringPool[i]
      if (!r || !r.active) continue

      r.lifetime += dt
      if (r.lifetime >= r.maxLifetime) {
        r.active = false
        r.mesh.visible = false
        continue
      }

      const progress = r.lifetime / r.maxLifetime
      const scale = r.startScale + progress * (r.targetScale - r.startScale)
      r.mesh.scale.setScalar(scale)

      const mat = r.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * (r.baseOpacity ?? 0.85)
    }
  }

  private updateDashPool(dt: number): void {
    for (let i = 0; i < this.dashPool.length; i++) {
      const g = this.dashPool[i]
      if (!g || !g.active) continue

      g.lifetime += dt
      if (g.lifetime >= g.maxLifetime) {
        g.active = false
        g.mesh.visible = false
        continue
      }

      const progress = g.lifetime / g.maxLifetime
      const scale = 1 - progress * 0.35
      g.mesh.scale.setScalar(scale)
      const mat = g.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.55
    }
  }

  private updateSpeedLinePool(dt: number): void {
    for (let i = 0; i < this.speedLinePool.length; i++) {
      const l = this.speedLinePool[i]
      if (!l || !l.active) continue

      l.lifetime += dt
      if (l.lifetime >= l.maxLifetime) {
        l.active = false
        l.mesh.visible = false
        continue
      }

      const progress = l.lifetime / l.maxLifetime
      l.mesh.position.x += l.velocity.x * dt
      l.mesh.position.y += l.velocity.y * dt
      l.mesh.position.z += l.velocity.z * dt

      const mat = l.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.55
    }
  }

  private updateBeacon(dt: number): void {
    if (!this.beaconActive) return
    this.beaconTimer -= dt
    if (this.beaconTimer <= 0) {
      this.beaconActive = false
      this.beaconMesh.visible = false
      return
    }
    const mat = this.beaconMesh.material as THREE.MeshBasicMaterial
    mat.opacity = Math.min(0.8, this.beaconTimer * 0.5)
    this.beaconMesh.rotation.y += dt * 1.5
  }

  public dispose(): void {
    this.scene.remove(this.group)
    this.dustGeo.dispose()
    this.dustMat.dispose()
    this.sparkleGeo.dispose()
    this.sparkleMat.dispose()
    this.ringGeo.dispose()
    this.ringMat.dispose()
    this.dashGeo.dispose()
    this.dashMat.dispose()
    this.auraGeo.dispose()
    this.auraMat.dispose()
    this.hitSparkGeo.dispose()
    this.hitSparkMat.dispose()
    this.speedLineGeo.dispose()
    this.speedLineMat.dispose()
    this.beaconMesh.geometry.dispose()
    ;(this.beaconMesh.material as THREE.Material).dispose()

    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.dispose()
      }
    }
  }
}
