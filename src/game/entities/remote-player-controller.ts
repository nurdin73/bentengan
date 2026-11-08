import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import type { GameplayEntity, PlayerStatus, TeamId } from '../../types/game.types'
import { GAME_CONFIG } from '../core/constants'

export interface RemotePlayerControllerOptions {
  id: string
  name: string
  teamId: TeamId
  initialPosition: [number, number, number]
}

export class RemotePlayerController implements GameplayEntity {
  public readonly id: string
  public readonly name: string
  public readonly teamId: TeamId
  public readonly mesh: THREE.Group
  public readonly body: RAPIER.RigidBody
  public readonly collider: RAPIER.Collider

  private readonly physics: PhysicsWorld

  // Gameplay state
  public status: PlayerStatus = 'normal'
  public immunityUntil = 0
  public stunUntil = 0
  public isSprinting = false

  // Smooth network interpolation target transforms
  private readonly targetPosition = new THREE.Vector3()
  private targetRotationY = 0

  // Three.js visual elements
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly visorMat: THREE.MeshStandardMaterial
  private readonly immunityAuraMesh: THREE.Mesh
  private readonly immunityAuraMat: THREE.MeshBasicMaterial
  private readonly nameplateSprite: THREE.Sprite

  // Dizzy / Stunned visual orbit
  public readonly stunStarsGroup: THREE.Group
  private readonly stunStarGeo: THREE.OctahedronGeometry
  private readonly stunStarMat: THREE.MeshBasicMaterial

  constructor(scene: THREE.Scene, physics: PhysicsWorld, options: RemotePlayerControllerOptions) {
    this.id = options.id
    this.name = options.name || 'Lawan'
    this.teamId = options.teamId
    this.physics = physics

    const { characterRadius, characterHeight } = GAME_CONFIG.movement
    const initialY = options.initialPosition[1] + characterHeight / 2

    this.targetPosition.set(options.initialPosition[0], initialY, options.initialPosition[2])

    // 1. Create Three.js Visual Mesh Group
    this.mesh = new THREE.Group()
    this.mesh.userData = { playerId: this.id, type: 'remote_player' }
    this.mesh.position.copy(this.targetPosition)

    // Capsule Chibi Body
    const bodyGeo = new THREE.CapsuleGeometry(
      characterRadius,
      characterHeight - characterRadius * 2,
      8,
      16,
    )
    const color = options.teamId === 'blue' ? 0x3b82f6 : 0xef4444
    this.bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0,
    })
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat)
    bodyMesh.castShadow = true
    this.mesh.add(bodyMesh)

    // Direction Visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.2)
    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.2,
      transparent: true,
      opacity: 1.0,
    })
    const visor = new THREE.Mesh(visorGeo, this.visorMat)
    visor.position.set(0, characterHeight * 0.25, characterRadius * 0.9)
    this.mesh.add(visor)

    // Immunity visual aura
    const auraGeo = new THREE.TorusGeometry(0.65, 0.05, 8, 24)
    this.immunityAuraMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    })
    this.immunityAuraMesh = new THREE.Mesh(auraGeo, this.immunityAuraMat)
    this.immunityAuraMesh.rotation.x = Math.PI / 2
    this.immunityAuraMesh.visible = false
    this.mesh.add(this.immunityAuraMesh)

    // Overhead Billboard Nameplate Sprite
    this.nameplateSprite = this.createNameplateSprite(this.name, options.teamId)
    this.nameplateSprite.position.set(0, characterHeight + 0.4, 0)
    this.mesh.add(this.nameplateSprite)

    // Stunned Dizzy Stars Orbit (Overhead)
    this.stunStarsGroup = new THREE.Group()
    this.stunStarsGroup.position.set(0, characterHeight * 0.5 + 0.25, 0)
    this.stunStarsGroup.visible = false

    this.stunStarGeo = new THREE.OctahedronGeometry(0.12)
    this.stunStarMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })

    const starCount = 3
    const orbitRadius = 0.35
    for (let i = 0; i < starCount; i++) {
      const angle = (i * Math.PI * 2) / starCount
      const star = new THREE.Mesh(this.stunStarGeo, this.stunStarMat)
      star.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius)
      this.stunStarsGroup.add(star)
    }
    this.mesh.add(this.stunStarsGroup)

    scene.add(this.mesh)

    // 2. Rapier 3D Kinematic Rigid Body with Capsule Collider
    const R = physics.rapier
    const bodyDesc = R.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(options.initialPosition[0], initialY, options.initialPosition[2])
      .lockRotations()

    this.body = physics.world.createRigidBody(bodyDesc)

    const colliderDesc = R.ColliderDesc.capsule(
      (characterHeight - characterRadius * 2) / 2,
      characterRadius,
    )
      .setFriction(0.0)
      .setRestitution(0.0)

    this.collider = physics.world.createCollider(colliderDesc, this.body)
  }

  private createNameplateSprite(username: string, team: TeamId): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')

    if (ctx) {
      // Rounded background pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.strokeStyle = team === 'blue' ? '#3b82f6' : '#ef4444'
      ctx.lineWidth = 4

      const x = 8
      const y = 8
      const w = 240
      const h = 48
      const r = 24

      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Team indicator dot
      ctx.fillStyle = team === 'blue' ? '#60a5fa' : '#f87171'
      ctx.beginPath()
      ctx.arc(36, 32, 8, 0, Math.PI * 2)
      ctx.fill()

      // Username text
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const truncatedName = username.length > 12 ? username.substring(0, 11) + '…' : username
      ctx.fillText(truncatedName, 54, 32)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.scale.set(2.0, 0.5, 1.0)
    return sprite
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
    }
  }

  public teleportTo(x: number, y: number, z: number): void {
    const { characterHeight } = GAME_CONFIG.movement
    const posY = y + characterHeight / 2

    this.targetPosition.set(x, posY, z)
    this.mesh.position.set(x, posY, z)
    this.body.setTranslation({ x, y: posY, z }, true)
    this.body.setNextKinematicTranslation({ x, y: posY, z })
  }

  public setTargetTransform(
    pos: [number, number, number],
    rotY: number,
    status?: PlayerStatus,
    isSprinting?: boolean,
    immunityUntil?: number,
    stunUntil?: number,
  ): void {
    this.targetPosition.set(pos[0], pos[1], pos[2])
    this.targetRotationY = rotY

    if (status !== undefined) this.status = status
    if (isSprinting !== undefined) this.isSprinting = isSprinting
    if (immunityUntil !== undefined) this.immunityUntil = immunityUntil
    if (stunUntil !== undefined) this.stunUntil = stunUntil
  }

  public updateInterpolation(dt: number, now: number): void {
    // 1. Smoothly interpolate position towards target (lerp)
    const lerpFactor = Math.min(1.0, dt * 18) // 18 Hz responsive smoothing
    this.mesh.position.lerp(this.targetPosition, lerpFactor)

    // Update kinematic physics body position so physics raycasts and collisions stay in sync
    this.body.setNextKinematicTranslation({
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
    })

    // 2. Smoothly interpolate rotation (spherical/euler lerp)
    let diff = this.targetRotationY - this.mesh.rotation.y
    while (diff < -Math.PI) diff += Math.PI * 2
    while (diff > Math.PI) diff -= Math.PI * 2
    this.mesh.rotation.y += diff * lerpFactor

    // 3. Update Visual Status Overlays
    const isImmune = now < this.immunityUntil
    this.immunityAuraMesh.visible = isImmune
    if (isImmune) {
      this.immunityAuraMesh.rotation.z += dt * 3
    }

    const isStunned = this.status === 'stunned' || now < this.stunUntil
    this.stunStarsGroup.visible = isStunned
    if (isStunned) {
      this.stunStarsGroup.rotation.y += dt * 6
    }

    if (this.status === 'jailed') {
      this.bodyMat.opacity = 0.45
      this.visorMat.opacity = 0.45
    } else if (this.status === 'stunned') {
      this.bodyMat.opacity = 0.75
      this.visorMat.opacity = 0.75
    } else {
      this.bodyMat.opacity = 1.0
      this.visorMat.opacity = 1.0
    }
  }

  public dispose(scene?: THREE.Scene): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    } else if (scene) {
      scene.remove(this.mesh)
    }
    this.physics.world.removeCollider(this.collider, false)
    this.physics.world.removeRigidBody(this.body)
    this.bodyMat.dispose()
    this.visorMat.dispose()
    this.immunityAuraMat.dispose()
    this.immunityAuraMesh.geometry.dispose()
    this.stunStarGeo.dispose()
    this.stunStarMat.dispose()
    if (this.nameplateSprite.material.map) {
      this.nameplateSprite.material.map.dispose()
    }
    this.nameplateSprite.material.dispose()
  }
}
