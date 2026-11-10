import * as THREE from 'three'
import { GAME_CONFIG } from '../core/constants'
import { useSettingsStore } from '../../stores/settings-store'

export interface Vector3Position {
  x: number
  y: number
  z: number
}

interface Particle {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
  velocity: THREE.Vector3
  initialScale: number
  scaleMultiplier: number
}

interface ShockwaveRing {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
  startScale: number
  targetScale: number
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

  // Shockwave rings pool (capture / base touch)
  private readonly ringPool: ShockwaveRing[] = []
  private readonly ringGeo: THREE.RingGeometry
  private readonly ringMat: THREE.MeshBasicMaterial

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
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.dustGeo, this.dustMat.clone())
      mesh.visible = false
      this.group.add(mesh)
      this.dustPool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: 0.45,
        velocity: new THREE.Vector3(),
        initialScale: 0.8,
        scaleMultiplier: 2.2,
      })
    }

    // 2. Sparkles Pool Initialization (Pre-allocated 32 particles)
    this.sparkleGeo = new THREE.OctahedronGeometry(0.14, 0)
    this.sparkleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(this.sparkleGeo, this.sparkleMat.clone())
      mesh.visible = false
      this.group.add(mesh)
      this.sparklePool.push({
        mesh,
        active: false,
        lifetime: 0,
        maxLifetime: 0.6,
        velocity: new THREE.Vector3(),
        initialScale: 1.0,
        scaleMultiplier: 0.2,
      })
    }

    // 3. Shockwave Rings Pool (Pre-allocated 6 rings)
    this.ringGeo = new THREE.RingGeometry(0.3, 0.45, 24)
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    for (let i = 0; i < 6; i++) {
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
      })
    }

    // 4. Base Touch Beacon Cylinder
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

  private isHighDensity(): boolean {
    try {
      const settings = useSettingsStore()
      return settings.particleDensity === 'high'
    } catch {
      return true
    }
  }

  /**
   * Spawns a dust puff at the given position (e.g., player foot when sprinting).
   * Offsets character center origin downwards to foot level if isCenterOrigin is true.
   */
  public spawnSprintDust(pos: Vector3Position, isCenterOrigin = true): void {
    if (!this.isHighDensity() && Math.random() < 0.5) return

    const particle = this.dustPool.find((p) => !p.active)
    if (!particle) return

    particle.active = true
    particle.lifetime = 0
    particle.maxLifetime = 0.35 + Math.random() * 0.15
    const halfHeight = GAME_CONFIG.movement.characterHeight / 2
    const footY = isCenterOrigin ? pos.y - halfHeight : pos.y
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
    ;(particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55
    particle.mesh.visible = true
  }

  /**
   * Spawns an expanding shockwave ring on tag capture
   */
  public spawnCaptureRing(pos: Vector3Position, color: number = 0xf59e0b): void {
    const ring = this.ringPool.find((r) => !r.active)
    if (!ring) return

    ring.active = true
    ring.lifetime = 0
    ring.maxLifetime = 0.42
    ring.startScale = 0.4
    ring.targetScale = 3.2
    ring.mesh.position.set(pos.x, pos.y + 0.15, pos.z)
    ring.mesh.scale.setScalar(ring.startScale)
    const mat = ring.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 0.9
    ring.mesh.visible = true
  }

  /**
   * Spawns sparkling burst when a player is rescued from jail
   */
  public spawnRescueSparkles(pos: Vector3Position): void {
    const count = this.isHighDensity() ? 16 : 8
    let spawned = 0

    for (const particle of this.sparklePool) {
      if (particle.active) continue

      particle.active = true
      particle.lifetime = 0
      particle.maxLifetime = 0.5 + Math.random() * 0.2
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
   * Triggers a vertical light beacon when base pillar is touched
   */
  public triggerBaseBeacon(pos: Vector3Position, color: number = 0xfacc15): void {
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
   * Frame-by-frame update loop (Zero allocation inside tick)
   */
  public update(dt: number): void {
    // 1. Update Dust Particles
    for (let i = 0; i < this.dustPool.length; i++) {
      const p = this.dustPool[i]
      if (!p || !p.active) continue

      p.lifetime += dt
      if (p.lifetime >= p.maxLifetime) {
        p.active = false
        p.mesh.visible = false
        continue
      }

      const progress = p.lifetime / p.maxLifetime
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt

      const curScale = p.initialScale + progress * p.scaleMultiplier
      p.mesh.scale.setScalar(curScale)

      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.6
    }

    // 2. Update Sparkles
    for (let i = 0; i < this.sparklePool.length; i++) {
      const p = this.sparklePool[i]
      if (!p || !p.active) continue

      p.lifetime += dt
      if (p.lifetime >= p.maxLifetime) {
        p.active = false
        p.mesh.visible = false
        continue
      }

      const progress = p.lifetime / p.maxLifetime
      p.velocity.y -= 4.0 * dt // gravity pull
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt

      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.95
      p.mesh.scale.setScalar(1.0 - progress * 0.7)
    }

    // 3. Update Shockwave Rings
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
      mat.opacity = (1 - progress) * 0.85
    }

    // 4. Update Beacon Beam
    if (this.beaconActive) {
      this.beaconTimer -= dt
      if (this.beaconTimer <= 0) {
        this.beaconActive = false
        this.beaconMesh.visible = false
      } else {
        const mat = this.beaconMesh.material as THREE.MeshBasicMaterial
        mat.opacity = Math.min(0.8, this.beaconTimer * 0.5)
        this.beaconMesh.rotation.y += dt * 1.5
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.group)
    this.dustGeo.dispose()
    this.dustMat.dispose()
    this.sparkleGeo.dispose()
    this.sparkleMat.dispose()
    this.ringGeo.dispose()
    this.ringMat.dispose()
    this.beaconMesh.geometry.dispose()
    ;(this.beaconMesh.material as THREE.Material).dispose()
  }
}
