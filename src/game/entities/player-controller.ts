import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import type { GameplayEntity, MovementInput, PlayerStatus, TeamId } from '../../types/game.types'
import { GAME_CONFIG } from '../core/constants'

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export interface PlayerControllerOptions {
  id: string
  name?: string
  teamId: TeamId
  initialPosition: [number, number, number]
}

export class PlayerController implements GameplayEntity {
  public readonly id: string
  public readonly name: string
  public readonly teamId: TeamId
  public readonly mesh: THREE.Group
  public readonly body: RAPIER.RigidBody
  public readonly collider: RAPIER.Collider

  private readonly physics: PhysicsWorld

  // Gameplay state
  public status: PlayerStatus = 'normal'
  public stamina: number = GAME_CONFIG.stamina.max
  public isSprinting = false
  public isGrounded = false
  public immunityUntil = 0
  public stunUntil = 0

  // Single jump state tracking
  private wasJumpPressed = false

  // Visual interpolation transforms (sub-frame smoothing to eliminate jitter)
  public readonly previousPosition = new THREE.Vector3()
  public readonly currentPosition = new THREE.Vector3()
  private targetRotationY = 0

  // Materials for opacity control
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly visorMat: THREE.MeshStandardMaterial

  // Immunity Aura Visual
  private readonly immunityAuraMesh: THREE.Mesh
  private readonly immunityAuraMat: THREE.MeshBasicMaterial

  // Dizzy / Stunned visual orbit
  public readonly stunStarsGroup: THREE.Group
  private readonly stunStarGeo: THREE.OctahedronGeometry
  private readonly stunStarMat: THREE.MeshBasicMaterial

  // Overhead 3D Player Name & Stamina Bar Sprite
  public readonly overheadSprite: THREE.Sprite
  private readonly overheadCanvas: HTMLCanvasElement
  private readonly overheadCtx: CanvasRenderingContext2D | null
  private readonly overheadTexture: THREE.CanvasTexture
  private lastRenderedStamina = -1
  private lastRenderedStatus: PlayerStatus | '' = ''
  private lastRenderedSprinting = false

  // Pre-allocated scratch objects for zero-allocation tick loops (Rule 3.A)
  private readonly scratchMove = new THREE.Vector3()
  private readonly scratchVelocity = { x: 0, y: 0, z: 0 }
  private readonly groundRay: RAPIER.Ray
  private readonly wallProbeRay: RAPIER.Ray

  constructor(scene: THREE.Scene, physics: PhysicsWorld, options: PlayerControllerOptions) {
    this.id = options.id
    this.name = options.name || 'Anda'
    this.teamId = options.teamId
    this.physics = physics

    const { characterRadius, characterHeight } = GAME_CONFIG.movement
    const initialY = options.initialPosition[1] + characterHeight / 2

    this.previousPosition.set(options.initialPosition[0], initialY, options.initialPosition[2])
    this.currentPosition.copy(this.previousPosition)

    // 1. Create Three.js Visual Mesh (Stylized Chibi Capsule)
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.previousPosition)

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
    })
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat)
    bodyMesh.castShadow = true
    this.mesh.add(bodyMesh)

    // Face / eye direction visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.2)
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 })
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

    // Overhead 3D Player Nameplate & Dynamic Stamina Bar
    this.overheadCanvas = document.createElement('canvas')
    this.overheadCanvas.width = 256
    this.overheadCanvas.height = 72
    this.overheadCtx = this.overheadCanvas.getContext('2d')

    this.overheadTexture = new THREE.CanvasTexture(this.overheadCanvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: this.overheadTexture,
      transparent: true,
      depthTest: false,
    })
    this.overheadSprite = new THREE.Sprite(spriteMat)
    this.overheadSprite.scale.set(2.2, 0.62, 1.0)
    this.overheadSprite.position.set(0, characterHeight + 0.45, 0)
    this.mesh.add(this.overheadSprite)
    this.updateOverheadDisplay()

    scene.add(this.mesh)

    // 2. Create Rapier 3D Dynamic Rigid Body with locked rotations & CCD
    const R = physics.rapier
    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(options.initialPosition[0], initialY, options.initialPosition[2])
      .lockRotations()
      .setLinearDamping(0.0)

    this.body = physics.world.createRigidBody(bodyDesc)
    this.body.enableCcd(true)

    // Collider capsule with strict zero friction & zero bounce (prevents wall sticking)
    const colliderDesc = R.ColliderDesc.capsule(
      (characterHeight - characterRadius * 2) / 2,
      characterRadius,
    )
      .setFriction(0.0)
      .setFrictionCombineRule(R.CoefficientCombineRule.Min)
      .setRestitution(0.0)
      .setRestitutionCombineRule(R.CoefficientCombineRule.Min)

    this.collider = physics.world.createCollider(colliderDesc, this.body)

    // Pre-allocate ground check ray & wall probe ray
    this.groundRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
    this.wallProbeRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  }

  public recordPreviousPosition(): void {
    const pos = this.body.translation()
    this.previousPosition.set(pos.x, pos.y, pos.z)
  }

  public recordCurrentPosition(): void {
    const pos = this.body.translation()
    this.currentPosition.set(pos.x, pos.y, pos.z)
  }

  public updateFixed(input: MovementInput, dt: number, now: number): void {
    // 1. Check & Update Timed Conditions (Stun & Immunity)
    if (this.status === 'stunned') {
      if (now >= this.stunUntil) {
        this.status = 'normal'
      } else {
        const currentLinVel = this.body.linvel()
        this.body.setLinvel({ x: 0, y: currentLinVel.y, z: 0 }, true)
        this.wasJumpPressed = input.jump
        return
      }
    }

    if (this.status === 'jailed') {
      const currentLinVel = this.body.linvel()
      this.body.setLinvel({ x: 0, y: currentLinVel.y, z: 0 }, true)
      this.wasJumpPressed = input.jump
      return
    }

    // 2. Evaluate Movement Vector from Input
    let moveX = 0
    let moveZ = 0

    if (input.forward) moveZ -= 1
    if (input.backward) moveZ += 1
    if (input.left) moveX -= 1
    if (input.right) moveX += 1

    const isMoving = moveX !== 0 || moveZ !== 0

    // 3. Sprint & Stamina Mechanics
    const wantsSprint = input.sprint && isMoving && this.stamina > 0
    this.isSprinting = wantsSprint

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - GAME_CONFIG.stamina.sprintDrainPerSecond * dt)
      if (this.stamina === 0) {
        this.status = 'stunned'
        this.stunUntil = now + GAME_CONFIG.gameplay.stunDurationMs
        this.isSprinting = false
      }
    } else {
      this.stamina = Math.min(
        GAME_CONFIG.stamina.max,
        this.stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
    }

    // 4. Calculate Velocity relative to Camera Yaw
    const currentSpeed = this.isSprinting
      ? GAME_CONFIG.movement.sprintSpeed
      : GAME_CONFIG.movement.walkSpeed

    if (isMoving) {
      this.scratchMove.set(moveX, 0, moveZ).normalize()
      this.scratchMove.applyAxisAngle(THREE.Object3D.DEFAULT_UP, input.cameraYaw)

      let velX = this.scratchMove.x * currentSpeed
      let velZ = this.scratchMove.z * currentSpeed

      // Horizontal wall probe & tangent deflection (smooth wall-sliding)
      const pos = this.body.translation()
      this.wallProbeRay.origin.x = pos.x
      this.wallProbeRay.origin.y = pos.y
      this.wallProbeRay.origin.z = pos.z

      this.wallProbeRay.dir.x = this.scratchMove.x
      this.wallProbeRay.dir.y = 0
      this.wallProbeRay.dir.z = this.scratchMove.z

      const wallHit = this.physics.world.castRayAndGetNormal(
        this.wallProbeRay,
        GAME_CONFIG.movement.characterRadius + 0.12,
        true,
        undefined,
        undefined,
        this.collider,
      )

      if (wallHit !== null && Math.abs(wallHit.normal.y) < 0.4) {
        // Detected a vertical wall / obstacle in front: deflect velocity along wall tangent
        const dot = velX * wallHit.normal.x + velZ * wallHit.normal.z
        if (dot < 0) {
          velX -= wallHit.normal.x * dot
          velZ -= wallHit.normal.z * dot
        }
      }

      this.scratchVelocity.x = velX
      this.scratchVelocity.z = velZ

      this.targetRotationY = Math.atan2(this.scratchMove.x, this.scratchMove.z)
    } else {
      this.scratchVelocity.x = 0
      this.scratchVelocity.z = 0
    }

    // 5. Physics-Based Ground Raycast Check (with slope normal validation)
    const pos = this.body.translation()
    this.groundRay.origin.x = pos.x
    this.groundRay.origin.y = pos.y
    this.groundRay.origin.z = pos.z

    const { characterHeight } = GAME_CONFIG.movement
    const maxToi = characterHeight / 2 + 0.12 // 0.8 + 0.12 = 0.92m

    const groundHit = this.physics.world.castRayAndGetNormal(
      this.groundRay,
      maxToi,
      true,
      undefined,
      undefined,
      this.collider,
    )

    const currentLinVel = this.body.linvel()
    // Grounded requires physical ray hit on an upward slope (normal.y >= 0.5) and no upward jump velocity
    this.isGrounded =
      groundHit !== null && groundHit.normal.y >= 0.5 && currentLinVel.y <= 0.2

    // 6. Strict Single Jump Restriction (Edge Trigger)
    const isNewJumpPress = input.jump && !this.wasJumpPressed
    let targetVelY = currentLinVel.y

    if (isNewJumpPress && this.isGrounded) {
      targetVelY = GAME_CONFIG.movement.jumpImpulse
      this.isGrounded = false
    }

    this.wasJumpPressed = input.jump
    this.scratchVelocity.y = targetVelY

    // Apply linear velocity to physics body
    this.body.setLinvel(this.scratchVelocity, true)
  }

  public teleportTo(x: number, y: number, z: number): void {
    const { characterHeight } = GAME_CONFIG.movement
    const targetY = y + characterHeight / 2
    this.body.setTranslation({ x, y: targetY, z }, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.previousPosition.set(x, targetY, z)
    this.currentPosition.set(x, targetY, z)
    this.mesh.position.set(x, targetY, z)
  }

  public syncVisuals(alpha = 1.0, now = performance.now()): void {
    // Sub-frame linear interpolation to eliminate 60Hz/144Hz refresh-rate jitter
    this.mesh.position.lerpVectors(this.previousPosition, this.currentPosition, alpha)

    // Smooth rotational turning
    const diff = this.targetRotationY - this.mesh.rotation.y
    const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.mesh.rotation.y += normalizedDiff * 0.3

    // Immunity aura visualization
    if (this.immunityAuraMesh) {
      const isImmune = now < this.immunityUntil
      this.immunityAuraMesh.visible = isImmune
      if (isImmune) {
        this.immunityAuraMesh.rotation.z += 0.04
      }
    }

    // Stunned dizzy stars visualization
    const isStunned = this.status === 'stunned' || now < this.stunUntil
    this.stunStarsGroup.visible = isStunned
    if (isStunned) {
      this.stunStarsGroup.rotation.y += 0.08
    }

    // Overhead 3D nameplate & stamina bar update
    this.updateOverheadDisplay()
  }

  public updateOverheadDisplay(): void {
    if (!this.overheadCtx) return

    const staminaInt = Math.round(this.stamina)
    if (
      staminaInt === this.lastRenderedStamina &&
      this.status === this.lastRenderedStatus &&
      this.isSprinting === this.lastRenderedSprinting
    ) {
      return
    }

    this.lastRenderedStamina = staminaInt
    this.lastRenderedStatus = this.status
    this.lastRenderedSprinting = this.isSprinting

    const ctx = this.overheadCtx
    ctx.clearRect(0, 0, 256, 72)

    // 1. Top Row: Rounded Nameplate Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
    ctx.strokeStyle = this.teamId === 'blue' ? '#3b82f6' : '#ef4444'
    ctx.lineWidth = 3

    const npX = 8
    const npY = 4
    const npW = 240
    const npH = 38
    const npR = 19
    drawRoundedRect(ctx, npX, npY, npW, npH, npR)
    ctx.fill()
    ctx.stroke()

    // Team indicator dot
    ctx.fillStyle = this.teamId === 'blue' ? '#60a5fa' : '#f87171'
    ctx.beginPath()
    ctx.arc(32, 23, 6, 0, Math.PI * 2)
    ctx.fill()

    // Username text
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const truncated = this.name.length > 12 ? this.name.substring(0, 11) + '…' : this.name
    ctx.fillText(truncated, 48, 23)

    // 2. Bottom Row: Sleek Stamina Bar
    const barX = 14
    const barY = 46
    const barW = 228
    const barH = 16
    const barR = 8

    // Background Track
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)'
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, barX, barY, barW, barH, barR)
    ctx.fill()
    ctx.stroke()

    // Dynamic Fill
    const ratio = Math.max(0, Math.min(1, this.stamina / GAME_CONFIG.stamina.max))
    const fillW = Math.max(0, (barW - 4) * ratio)

    if (fillW > 0) {
      if (this.status === 'stunned') {
        ctx.fillStyle = '#ef4444'
      } else if (ratio > 0.5) {
        ctx.fillStyle = '#10b981'
      } else if (ratio > 0.25) {
        ctx.fillStyle = '#f59e0b'
      } else {
        ctx.fillStyle = '#f43f5e'
      }

      drawRoundedRect(ctx, barX + 2, barY + 2, fillW, barH - 4, Math.max(2, barR - 2))
      ctx.fill()
    }

    this.overheadTexture.needsUpdate = true
  }

  public setVisualOpacity(opacity: number): void {
    const isTransparent = opacity < 0.99
    this.bodyMat.transparent = isTransparent
    this.bodyMat.opacity = opacity
    this.visorMat.transparent = isTransparent
    this.visorMat.opacity = opacity
    if (this.overheadSprite.material) {
      this.overheadSprite.material.opacity = opacity
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.currentPosition
  }

  public dispose(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
    this.bodyMat.dispose()
    this.visorMat.dispose()
    this.immunityAuraMat.dispose()
    this.immunityAuraMesh.geometry.dispose()
    this.stunStarGeo.dispose()
    this.stunStarMat.dispose()
    if (this.overheadTexture) {
      this.overheadTexture.dispose()
    }
    if (this.overheadSprite.material) {
      this.overheadSprite.material.dispose()
    }
    this.physics.world.removeCollider(this.collider, false)
    this.physics.world.removeRigidBody(this.body)
  }
}
