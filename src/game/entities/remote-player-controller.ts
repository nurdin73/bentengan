import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import type { GameplayEntity, PlayerStatus, TeamId } from '../../types/game.types'
import { GAME_CONFIG } from '../core/constants'
import { EnergyShieldBubble } from './energy-shield-bubble'
import { CharacterAvatar } from './character-avatar'

export interface RemotePlayerControllerOptions {
  id: string
  name: string
  teamId: TeamId
  initialPosition: [number, number, number]
  outfitId?: number
}

export class RemotePlayerController implements GameplayEntity {
  public readonly id: string
  public readonly name: string
  public readonly teamId: TeamId
  public readonly mesh: THREE.Group
  public readonly avatar: CharacterAvatar
  public readonly body: RAPIER.RigidBody
  public readonly collider: RAPIER.Collider

  private readonly physics: PhysicsWorld

  // Gameplay state
  public status: PlayerStatus = 'normal'
  public immunityUntil = 0
  public stunUntil = 0
  public rescueCooldownUntil = 0
  public isSprinting = false

  // Smooth network interpolation target transforms
  private readonly targetPosition = new THREE.Vector3()
  private targetRotationY = 0

  // Three.js visual elements
  private readonly bodyMesh: THREE.Mesh
  private readonly bodyGeo: THREE.CapsuleGeometry
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly visorMat: THREE.MeshStandardMaterial
  private readonly shieldBubble: EnergyShieldBubble
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
    this.bodyGeo = new THREE.CapsuleGeometry(
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
    this.bodyMesh = new THREE.Mesh(this.bodyGeo, this.bodyMat)
    this.bodyMesh.castShadow = true
    this.bodyMesh.visible = false
    this.mesh.add(this.bodyMesh)

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
    visor.visible = false
    this.mesh.add(visor)

    // Modular 3D Soft-box Character Avatar
    this.avatar = new CharacterAvatar({
      teamId: options.teamId,
      outfitId: options.outfitId ?? 1,
    })
    this.mesh.add(this.avatar.rootGroup)

    // Immunity visual energy shield bubble
    this.shieldBubble = new EnergyShieldBubble()
    this.mesh.add(this.shieldBubble.group)

    // Overhead Billboard Nameplate Sprite
    this.nameplateSprite = this.createNameplateSprite(this.name, options.teamId)
    this.nameplateSprite.position.set(0, characterHeight * 0.5 + 0.35, 0)
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
    canvas.height = 48
    const ctx = canvas.getContext('2d')

    if (ctx) {
      const truncatedName = username.length > 12 ? username.substring(0, 11) + '…' : username

      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Dark stroke outline
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)'
      ctx.lineWidth = 3.5
      ctx.lineJoin = 'round'
      ctx.strokeText(truncatedName, 128, 24)

      // Team colored text with crisp outline
      ctx.fillStyle = team === 'blue' ? '#93c5fd' : '#fca5a5'
      ctx.fillText(truncatedName, 128, 24)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.scale.set(1.6, 0.35, 1.0)
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
    const isMoving =
      this.mesh.position.distanceToSquared(this.targetPosition) > 0.001 || this.isSprinting

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
    this.shieldBubble.update(isImmune, now)

    const isStunned = this.status === 'stunned' || now < this.stunUntil
    this.stunStarsGroup.visible = isStunned
    if (isStunned) {
      this.stunStarsGroup.rotation.y += dt * 6
    }

    if (this.status === 'jailed') {
      this.bodyMat.opacity = 0.45
      this.visorMat.opacity = 0.45
      this.avatar.setOpacity(0.45)
    } else if (this.status === 'stunned') {
      this.bodyMat.opacity = 0.75
      this.visorMat.opacity = 0.75
      this.avatar.setOpacity(0.75)
    } else {
      this.bodyMat.opacity = 1.0
      this.visorMat.opacity = 1.0
      this.avatar.setOpacity(1.0)
    }

    // 4. Procedural running forward tilt & subtle chibi waddle
    if (isMoving && !isStunned && this.status !== 'jailed') {
      const targetTilt = this.isSprinting ? 0.22 : 0.12
      this.bodyMesh.rotation.x = THREE.MathUtils.lerp(this.bodyMesh.rotation.x, targetTilt, 12 * dt)
      this.bodyMesh.rotation.z = Math.sin(now * 0.012) * 0.06
    } else {
      this.bodyMesh.rotation.x = THREE.MathUtils.lerp(this.bodyMesh.rotation.x, 0, 14 * dt)
      this.bodyMesh.rotation.z = THREE.MathUtils.lerp(this.bodyMesh.rotation.z, 0, 14 * dt)
    }

    const animSpeed = isMoving
      ? this.isSprinting
        ? GAME_CONFIG.movement.sprintSpeed
        : GAME_CONFIG.movement.walkSpeed
      : 0
    this.avatar.updateAnimation(
      dt,
      animSpeed,
      true,
      this.isSprinting,
      isStunned,
      this.status === 'jailed',
    )
  }

  public dispose(scene?: THREE.Scene): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    } else if (scene) {
      scene.remove(this.mesh)
    }
    this.avatar.dispose()
    this.physics.world.removeCollider(this.collider, false)
    this.physics.world.removeRigidBody(this.body)
    this.bodyGeo.dispose()
    this.bodyMat.dispose()
    this.visorMat.dispose()
    this.shieldBubble.dispose()
    this.stunStarGeo.dispose()
    this.stunStarMat.dispose()
    if (this.nameplateSprite.material.map) {
      this.nameplateSprite.material.map.dispose()
    }
    this.nameplateSprite.material.dispose()
  }
}
