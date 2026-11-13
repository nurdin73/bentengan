import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import type { GameplayEntity, PlayerStatus, TeamId } from '../../types/game.types'
import { GameplayRules } from '../systems/gameplay-rules'
import { GAME_CONFIG } from '../core/constants'
import { EnergyShieldBubble } from './energy-shield-bubble'
import { CharacterAvatar, type AvatarAnimationExtras } from './character-avatar'

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

export type BotRole = 'attacker' | 'defender' | 'hybrid'

export interface BotControllerOptions {
  id: string
  name: string
  teamId: TeamId
  role?: BotRole
  initialPosition: [number, number, number]
  patrolCenter?: [number, number, number]
  patrolRadius?: number
  targetObjective?: [number, number, number]
  enemyBasePosition?: [number, number, number]
  allyJailPosition?: [number, number, number]
  outfitId?: number
}

export class BotController implements GameplayEntity {
  public readonly id: string
  public readonly name: string
  public readonly teamId: TeamId
  public role: BotRole
  public targetObjective: THREE.Vector3 | null = null
  public enemyBasePosition: THREE.Vector3 | null = null
  public allyJailPosition: THREE.Vector3 | null = null
  public isRetreating = false
  public regroupDelayTimer = 0
  private dodgeDirection = 1
  private dodgeTimer = 0
  private readonly jukeVector = new THREE.Vector3()
  public readonly mesh: THREE.Group
  public readonly bodyMesh: THREE.Mesh
  public readonly avatar: CharacterAvatar
  public readonly body: RAPIER.RigidBody
  public readonly collider: RAPIER.Collider

  private readonly physics: PhysicsWorld

  // Gameplay state
  public status: PlayerStatus = 'normal'
  public stamina: number = GAME_CONFIG.stamina.max
  public isSprinting = false
  public isExhausted = false
  public immunityUntil = 0
  public stunUntil = 0
  public rescueCooldownUntil = 0
  public confoundedUntil = 0
  public isFrozen = false
  public justJumped = false
  public justLanded = false
  private wasGrounded = true
  private landSquashTimer = 0
  private tagSwipeTimer = 0
  public isVictorious = false
  private readonly animExtras: AvatarAnimationExtras = {}

  // Visual interpolation transforms
  public readonly previousPosition = new THREE.Vector3()
  public readonly currentPosition = new THREE.Vector3()
  private targetRotationY = 0
  private runAnimCycle = 0
  private readonly normalScale = new THREE.Vector3(1, 1, 1)

  // Overhead 3D Bot Name & Stamina Bar Sprite
  private readonly overheadCanvas: HTMLCanvasElement | null = null
  private readonly overheadCtx: CanvasRenderingContext2D | null = null
  private readonly overheadTexture: THREE.CanvasTexture | null = null
  public readonly overheadSprite: THREE.Sprite
  private lastRenderedStamina = -1
  private lastRenderedStatus: PlayerStatus = 'normal'
  private lastRenderedSprinting = false

  // Patrol / AI state
  private patrolCenter: THREE.Vector3
  private patrolRadius: number
  private patrolTimer = 0
  public readonly patrolDirection = new THREE.Vector3()

  // Materials & visual cues
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly visorMat: THREE.MeshStandardMaterial
  private readonly shieldBubble: EnergyShieldBubble

  // Dizzy / Stunned visual orbit
  public readonly stunStarsGroup: THREE.Group
  private readonly stunStarGeo: THREE.OctahedronGeometry
  private readonly stunStarMat: THREE.MeshBasicMaterial

  // Scratch objects (Rule 3.A)
  private readonly scratchVel = { x: 0, y: 0, z: 0 }
  private readonly wallProbeRay: RAPIER.Ray
  private readonly upperClearanceRay: RAPIER.Ray
  private readonly losRay: RAPIER.Ray
  private lastSeenTargetPos: THREE.Vector3 | null = null
  private searchTimer = 0

  // Stuck detection & unstuck juke state
  private readonly lastStuckCheckPos = new THREE.Vector3()
  private stuckSampleTimer = 0
  private unstuckTimer = 0
  private readonly unstuckDirection = new THREE.Vector3()

  constructor(scene: THREE.Scene, physics: PhysicsWorld, options: BotControllerOptions) {
    this.id = options.id
    this.name = options.name
    this.teamId = options.teamId
    this.role = options.role || 'attacker'
    if (options.targetObjective) {
      this.targetObjective = new THREE.Vector3(
        options.targetObjective[0],
        options.targetObjective[1],
        options.targetObjective[2],
      )
    }
    if (options.enemyBasePosition) {
      this.enemyBasePosition = new THREE.Vector3(
        options.enemyBasePosition[0],
        options.enemyBasePosition[1],
        options.enemyBasePosition[2],
      )
    } else if (this.targetObjective) {
      this.enemyBasePosition = this.targetObjective.clone()
    }
    if (options.allyJailPosition) {
      this.allyJailPosition = new THREE.Vector3(
        options.allyJailPosition[0],
        options.allyJailPosition[1],
        options.allyJailPosition[2],
      )
    }
    this.physics = physics

    this.patrolCenter = new THREE.Vector3(
      options.patrolCenter ? options.patrolCenter[0] : options.initialPosition[0],
      options.patrolCenter ? options.patrolCenter[1] : options.initialPosition[1],
      options.patrolCenter ? options.patrolCenter[2] : options.initialPosition[2],
    )
    this.patrolRadius = options.patrolRadius || 8.0

    const { characterRadius, characterHeight } = GAME_CONFIG.movement
    const initialY = options.initialPosition[1] + characterHeight / 2

    this.previousPosition.set(options.initialPosition[0], initialY, options.initialPosition[2])
    this.currentPosition.copy(this.previousPosition)

    // 1. Mesh setup
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.previousPosition)

    const bodyGeo = new THREE.CapsuleGeometry(
      characterRadius,
      characterHeight - characterRadius * 2,
      8,
      16,
    )
    const color = options.teamId === 'blue' ? 0x2563eb : 0xdc2626
    this.bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat)
    this.bodyMesh.castShadow = true
    this.bodyMesh.visible = false
    this.mesh.add(this.bodyMesh)

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.2)
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
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

    // Overhead 3D Bot Nameplate & Dynamic Stamina Bar
    this.overheadCanvas = document.createElement('canvas')
    this.overheadCanvas.width = 256
    this.overheadCanvas.height = 60
    this.overheadCtx = this.overheadCanvas.getContext('2d')

    this.overheadTexture = new THREE.CanvasTexture(this.overheadCanvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: this.overheadTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    })
    this.overheadSprite = new THREE.Sprite(spriteMat)
    this.overheadSprite.scale.set(1.7, 0.42, 1.0)
    this.overheadSprite.position.set(0, characterHeight * 0.5 + 0.35, 0)
    this.mesh.add(this.overheadSprite)
    this.updateOverheadDisplay()

    scene.add(this.mesh)

    // 2. Rapier 3D dynamic body with CCD and zero friction
    const R = physics.rapier
    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(options.initialPosition[0], initialY, options.initialPosition[2])
      .lockRotations()
      .setLinearDamping(0.0)

    this.body = physics.world.createRigidBody(bodyDesc)
    this.body.enableCcd(true)

    const colliderDesc = R.ColliderDesc.capsule(
      (characterHeight - characterRadius * 2) / 2,
      characterRadius,
    )
      .setFriction(0.0)
      .setFrictionCombineRule(R.CoefficientCombineRule.Min)

    this.collider = physics.world.createCollider(colliderDesc, this.body)
    this.wallProbeRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
    this.upperClearanceRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
    this.losRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
    this.lastStuckCheckPos.copy(this.previousPosition)
  }

  public recordPreviousPosition(): void {
    const pos = this.body.translation()
    this.previousPosition.set(pos.x, pos.y, pos.z)
  }

  public recordCurrentPosition(): void {
    const pos = this.body.translation()
    this.currentPosition.set(pos.x, pos.y, pos.z)
  }

  /**
   * Performs an obstacle line-of-sight raycast from the bot to targetPos.
   * Returns false if an intervening static box/wall collider blocks direct vision.
   */
  public hasLineOfSight(targetPos: { x: number; y: number; z: number }): boolean {
    const myPos = this.body.translation()
    const eyeHeight = 0.5
    const originX = myPos.x
    const originY = myPos.y + eyeHeight
    const originZ = myPos.z

    const targetY = (targetPos.y ?? myPos.y) + eyeHeight
    const dx = targetPos.x - originX
    const dy = targetY - originY
    const dz = targetPos.z - originZ
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < 0.2) return true

    const invDist = 1 / dist
    this.losRay.origin.x = originX
    this.losRay.origin.y = originY
    this.losRay.origin.z = originZ
    this.losRay.dir.x = dx * invDist
    this.losRay.dir.y = dy * invDist
    this.losRay.dir.z = dz * invDist

    const hit = this.physics.world.castRay(
      this.losRay,
      dist,
      true,
      undefined,
      undefined,
      this.collider,
    )

    if (!hit) {
      return true
    }

    // A static obstacle (box, wall, stone pillar) will be hit before reaching the target.
    // Margin of 0.45 accounts for character body radius.
    return hit.timeOfImpact >= dist - 0.45
  }

  public updateFixed(dt: number, now: number, potentialTargets: GameplayEntity[] = []): void {
    if (this.isFrozen) {
      const vel = this.body.linvel()
      this.body.setLinvel({ x: 0, y: vel.y, z: 0 }, true)
      return
    }

    if (this.status === 'stunned') {
      this.stamina = Math.min(
        GAME_CONFIG.stamina.max,
        this.stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
      if (this.stamina >= GAME_CONFIG.stamina.minSprintThreshold) {
        this.isExhausted = false
      }

      const hasElapsedStunDuration = now >= this.stunUntil
      const hasRecoveredStamina = this.stamina >= GAME_CONFIG.stamina.recoveryThreshold

      if (hasElapsedStunDuration && hasRecoveredStamina) {
        this.status = 'normal'
      } else {
        const vel = this.body.linvel()
        this.body.setLinvel({ x: 0, y: vel.y, z: 0 }, true)
        return
      }
    }

    if (this.status === 'jailed') {
      const vel = this.body.linvel()
      this.body.setLinvel({ x: 0, y: vel.y, z: 0 }, true)
      return
    }

    if (this.regroupDelayTimer > 0) {
      this.regroupDelayTimer -= dt
    }

    const myPos = this.body.translation()

    // Dynamic Objective Arbitration (User Rule: Guarded Base -> Rescue Teammate, Unguarded Base -> Base Capture)
    if (this.enemyBasePosition) {
      const activeEnemies = potentialTargets.filter(
        (t) => t.teamId !== this.teamId && t.status !== 'jailed' && t.status !== 'stunned',
      )
      const hasJailedTeammate = potentialTargets.some(
        (t) => t.teamId === this.teamId && t.status === 'jailed',
      )

      const baseGuardRadius = 9.0
      const isEnemyBaseGuarded = activeEnemies.some((enemy) => {
        return (
          GameplayRules.distance2D(enemy.getPosition(), this.enemyBasePosition!) <= baseGuardRadius
        )
      })

      const canRescue = !this.rescueCooldownUntil || now >= this.rescueCooldownUntil
      if (hasJailedTeammate && isEnemyBaseGuarded && this.allyJailPosition && canRescue) {
        // Base is guarded and a teammate is in jail (and bot is not on rescue cooldown): prioritize rescue mission!
        if (!this.targetObjective) {
          this.targetObjective = new THREE.Vector3()
        }
        this.targetObjective.copy(this.allyJailPosition)
      } else {
        // Base is unguarded OR no teammates need rescue: prioritize base capture to win!
        if (!this.targetObjective) {
          this.targetObjective = new THREE.Vector3()
        }
        this.targetObjective.copy(this.enemyBasePosition)
      }
    }

    // Unstuck monitoring & recovery
    if (this.unstuckTimer > 0) {
      this.unstuckTimer -= dt
      this.patrolDirection.copy(this.unstuckDirection)
    } else {
      this.stuckSampleTimer += dt
      if (this.stuckSampleTimer >= 0.4) {
        this.stuckSampleTimer = 0
        const dx = myPos.x - this.lastStuckCheckPos.x
        const dy = myPos.y - this.lastStuckCheckPos.y
        const dz = myPos.z - this.lastStuckCheckPos.z
        const distMoved = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (distMoved < 0.15 && this.status === 'normal') {
          // Bot is physically trapped/stuck against geometry: initiate juke
          this.unstuckTimer = 0.5
          const jukeAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2)
          const currAngle = Math.atan2(this.patrolDirection.x, this.patrolDirection.z)
          const newAngle = currAngle + jukeAngle
          this.unstuckDirection.set(Math.sin(newAngle), 0, Math.cos(newAngle)).normalize()
          this.patrolDirection.copy(this.unstuckDirection)
        }
        this.lastStuckCheckPos.set(myPos.x, myPos.y, myPos.z)
      }
    }

    const isConfounded = now < this.confoundedUntil
    const isSelfTrespassing = GameplayRules.isInEnemyTerritory(this)
    const homeDirZ = this.teamId === 'blue' ? -1.0 : 1.0
    const enemyDirZ = -homeDirZ
    const isImmune = now < this.immunityUntil
    const canSprint = this.status === 'normal' && !this.isExhausted && this.stamina > 0
    let wantsSprint = false
    let speed = GAME_CONFIG.movement.walkSpeed * 0.75

    if (isConfounded) {
      // Disoriented by smoke: wanders randomly at half walk speed, cannot acquire targets
      this.patrolTimer -= dt
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 0.8 + Math.random() * 0.8
        const angle = Math.random() * Math.PI * 2
        this.patrolDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize()
      }
      speed = GAME_CONFIG.movement.walkSpeed * 0.5
    } else if (isSelfTrespassing) {
      // 1. IN ENEMY TERRITORY:
      // While immune after rescue: must NOT rush enemy base, but retreat towards home territory
      if (isImmune) {
        this.isRetreating = true
      }

      // Compare distance to enemy base vs distance to home territory
      const distToHome = Math.abs(myPos.z)
      const distToBase = this.targetObjective
        ? GameplayRules.distance2D(myPos, this.targetObjective)
        : Infinity
      const isCloserToBaseThanHome =
        !isImmune && this.targetObjective !== null && distToBase < distToHome

      let nearestDefender: GameplayEntity | null = null
      let nearestDefenderDist = Infinity

      for (const t of potentialTargets) {
        if (t.teamId === this.teamId || t.status === 'jailed') continue
        const tPos = t.getPosition()
        const d = GameplayRules.distance3D(myPos, tPos)
        // Threat range: 3.2 meters with direct line of sight
        if (d < 3.2 && d < nearestDefenderDist && this.hasLineOfSight(tPos)) {
          nearestDefender = t
          nearestDefenderDist = d
        }
      }

      if (isCloserToBaseThanHome && this.targetObjective) {
        // A. GOAL RUSH: Bot is closer to enemy base than to home territory!
        // Must approach enemy base while dodging pursuer (random right, left, front, back safe angles)
        const toBaseX = this.targetObjective.x - myPos.x
        const toBaseZ = this.targetObjective.z - myPos.z
        const baseDist = Math.sqrt(toBaseX * toBaseX + toBaseZ * toBaseZ) || 1
        const baseNormX = toBaseX / baseDist
        const baseNormZ = toBaseZ / baseDist

        if (nearestDefender) {
          const tPos = nearestDefender.getPosition()
          const fromPursuerX = myPos.x - tPos.x
          const fromPursuerZ = myPos.z - tPos.z
          const pursuerDist =
            Math.sqrt(fromPursuerX * fromPursuerX + fromPursuerZ * fromPursuerZ) || 1
          const safeDirX = fromPursuerX / pursuerDist
          const safeDirZ = fromPursuerZ / pursuerDist

          // Random safe juke updates every 0.4 - 0.7s
          this.dodgeTimer -= dt
          if (this.dodgeTimer <= 0) {
            this.dodgeTimer = 0.4 + Math.random() * 0.3
            const candidateAngles = [
              0,
              Math.PI / 4,
              Math.PI / 2,
              (3 * Math.PI) / 4,
              Math.PI,
              -(3 * Math.PI) / 4,
              -Math.PI / 2,
              -Math.PI / 4,
            ]
            const shuffled = candidateAngles.sort(() => Math.random() - 0.5)
            let chosenAngle = 0
            for (const a of shuffled) {
              const candX = Math.sin(a)
              const candZ = Math.cos(a)
              // Ensure angle does not move toward pursuer
              if (candX * safeDirX + candZ * safeDirZ >= -0.1) {
                chosenAngle = a
                break
              }
            }
            this.jukeVector.set(Math.sin(chosenAngle), 0, Math.cos(chosenAngle))
          }

          // Blend Base Rush pull (60%) with Safe Omnidirectional Juke (50%)
          let steerX = baseNormX * 0.6 + this.jukeVector.x * 0.5
          let steerZ = baseNormZ * 0.6 + this.jukeVector.z * 0.5

          // Double check: ensure resulting vector doesn't plunge directly into pursuer
          if (steerX * safeDirX + steerZ * safeDirZ < -0.1) {
            steerX += safeDirX * 0.8
            steerZ += safeDirZ * 0.8
          }

          this.patrolDirection.set(steerX, 0, steerZ).normalize()
          if (canSprint && this.stamina > 15) {
            wantsSprint = true
            speed = GAME_CONFIG.movement.sprintSpeed * 0.95
          } else {
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        } else {
          // Coast is clear: only sprint for the final dash into base (<= 5.5m) to conserve stamina
          this.patrolDirection.set(baseNormX, 0, baseNormZ).normalize()
          if (
            baseDist <= 5.5 &&
            canSprint &&
            this.stamina >= GAME_CONFIG.stamina.minSprintThreshold
          ) {
            wantsSprint = true
            speed = GAME_CONFIG.movement.sprintSpeed * 0.9
          } else {
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        }
      } else {
        // B. NORMAL RETREAT / INFILTRATION (Closer to home territory than to enemy base, or isImmune)
        if (nearestDefender || isImmune) {
          this.isRetreating = true
        }

        if (this.isRetreating) {
          this.dodgeTimer -= dt
          if (this.dodgeTimer <= 0) {
            this.dodgeTimer = 0.6 + Math.random() * 0.4
            this.dodgeDirection = Math.random() > 0.5 ? 1 : -1
          }

          let steerX = -myPos.x * 0.15

          if (nearestDefender) {
            const tPos = nearestDefender.getPosition()
            const awayX = myPos.x - tPos.x
            if (Math.abs(awayX) > 0.3) {
              steerX += Math.sign(awayX) * 0.85
            } else {
              steerX += this.dodgeDirection * 0.85
            }
          } else {
            steerX += this.dodgeDirection * 0.5
          }

          const steerZ = homeDirZ * 2.0
          this.patrolDirection.set(steerX, 0, steerZ).normalize()
          if (nearestDefender && canSprint && this.stamina > 15) {
            wantsSprint = true
            speed = GAME_CONFIG.movement.sprintSpeed * 0.88
          } else {
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        } else {
          if (this.targetObjective) {
            const dx = this.targetObjective.x - myPos.x
            const dz = this.targetObjective.z - myPos.z
            this.patrolDirection.set(dx, 0, dz).normalize()
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          } else {
            this.patrolDirection.set(-myPos.x * 0.1, 0, enemyDirZ).normalize()
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        }
      }
    } else {
      // 2. IN HOME TERRITORY:
      // If retreating, enforce running to safe depth (>= 4m inside home) before resetting
      const safeHomeDepth = 4.0
      const isPastSafeDepth =
        this.teamId === 'blue' ? myPos.z <= -safeHomeDepth : myPos.z >= safeHomeDepth

      if (this.isRetreating) {
        if (!isPastSafeDepth) {
          // Continue retreating deep into home territory
          this.patrolDirection.set(-myPos.x * 0.15, 0, homeDirZ).normalize()
          let hasNearbyEnemy = false
          for (const t of potentialTargets) {
            if (t.teamId === this.teamId || t.status === 'jailed') continue
            if (GameplayRules.distance3D(myPos, t.getPosition()) < 3.2) {
              hasNearbyEnemy = true
              break
            }
          }
          if (hasNearbyEnemy && canSprint && this.stamina > 15) {
            wantsSprint = true
            speed = GAME_CONFIG.movement.sprintSpeed * 0.85
          } else {
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        } else {
          // Reached safe home depth! Reset retreat state and activate regroup cooldown delay (1.5 - 2.5s)
          this.isRetreating = false
          this.regroupDelayTimer = 1.5 + Math.random() * 1.0
        }
      }

      if (!this.isRetreating) {
        if (this.regroupDelayTimer > 0) {
          // REGROUP DELAY: Bot is catching breath / guarding home territory before next attack run
          this.patrolTimer -= dt
          if (this.patrolTimer <= 0) {
            this.patrolTimer = 1.5 + Math.random() * 1.5
            const angle = Math.random() * Math.PI * 2
            this.patrolDirection.set(Math.sin(angle), 0, Math.cos(angle))
          }
          // Pull gently towards patrol center / home base
          const dx = myPos.x - this.patrolCenter.x
          const dz = myPos.z - this.patrolCenter.z
          const distFromCenter = Math.sqrt(dx * dx + dz * dz)
          if (distFromCenter > 3.0) {
            this.patrolDirection.set(-dx, 0, -dz).normalize()
          }
          wantsSprint = false
          speed = GAME_CONFIG.movement.walkSpeed * 0.75
        } else if (this.role === 'hybrid') {
          // DUAL ROLE (Penyerang & Penjaga Sekaligus)
          // Check if any opponent intruder is trespassing in our home territory
          let intruderInHome: GameplayEntity | null = null
          let intruderDist = Infinity
          let isIntruderImmune = false

          for (const t of potentialTargets) {
            if (t.teamId === this.teamId || t.status === 'jailed') continue

            // Target is in our territory if isInEnemyTerritory(t) is true (from t's perspective)
            if (GameplayRules.isInEnemyTerritory(t)) {
              const tPos = t.getPosition()
              const d = GameplayRules.distance3D(myPos, tPos)
              if (d < intruderDist && this.hasLineOfSight(tPos)) {
                intruderInHome = t
                intruderDist = d
                isIntruderImmune = now < t.immunityUntil
              }
            }
          }

          if (intruderInHome) {
            const tPos = intruderInHome.getPosition()
            if (!this.lastSeenTargetPos) {
              this.lastSeenTargetPos = new THREE.Vector3()
            }
            this.lastSeenTargetPos.set(tPos.x, tPos.y, tPos.z)
            this.searchTimer = 1.5

            // SUB-STATE DEFENDER: Intruder in home yard! Protect benteng and intercept
            if (isIntruderImmune) {
              this.lastSeenTargetPos = null
              this.searchTimer = 0
              this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
              if (canSprint && this.stamina > 15) {
                wantsSprint = true
                speed = GAME_CONFIG.movement.sprintSpeed * 0.85
              } else {
                wantsSprint = false
                speed = GAME_CONFIG.movement.walkSpeed * 1.0
              }
            } else {
              this.patrolDirection.set(tPos.x - myPos.x, 0, tPos.z - myPos.z).normalize()
              if (canSprint && this.stamina >= 20) {
                wantsSprint = true
                speed = GAME_CONFIG.movement.sprintSpeed * 1.0
              } else {
                wantsSprint = false
                speed = GAME_CONFIG.movement.walkSpeed * 1.0
              }
            }
          } else if (this.lastSeenTargetPos && this.searchTimer > 0) {
            // Target lost behind an obstacle: investigate last seen position
            this.searchTimer -= dt
            const toLastX = this.lastSeenTargetPos.x - myPos.x
            const toLastZ = this.lastSeenTargetPos.z - myPos.z
            const distToLast = Math.sqrt(toLastX * toLastX + toLastZ * toLastZ)

            if (distToLast < 0.8 || this.searchTimer <= 0) {
              this.lastSeenTargetPos = null
              this.searchTimer = 0
            } else {
              this.patrolDirection.set(toLastX, 0, toLastZ).normalize()
              wantsSprint = false
              speed = GAME_CONFIG.movement.walkSpeed * 0.85
            }
          } else if (isImmune) {
            // SUB-STATE IMMUNE REGROUP: Home is clear, but immunity is still active.
            // Hold position in home territory and do not rush border until immunity expires
            const dx = myPos.x - this.patrolCenter.x
            const dz = myPos.z - this.patrolCenter.z
            const distFromCenter = Math.sqrt(dx * dx + dz * dz)
            if (distFromCenter > 2.0) {
              this.patrolDirection.set(-dx, 0, -dz).normalize()
            } else {
              this.patrolDirection.set(Math.sin(now * 0.002), 0, Math.cos(now * 0.002)).normalize()
            }
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 0.75
          } else {
            // SUB-STATE ATTACKER: Home yard is completely clear and immunity expired! Advance across border
            if (this.targetObjective) {
              const dx = this.targetObjective.x - myPos.x
              const dz = this.targetObjective.z - myPos.z
              this.patrolDirection.set(dx, 0, dz).normalize()
            } else {
              this.patrolDirection.set(-myPos.x * 0.1, 0, enemyDirZ).normalize()
            }
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        } else if (this.role === 'attacker') {
          // Attacker prioritizes crossing the center border to attack enemy base
          let dangerousEnemy: GameplayEntity | null = null
          for (const t of potentialTargets) {
            if (t.teamId === this.teamId || t.status === 'jailed') continue
            const tPos = t.getPosition()
            const d = GameplayRules.distance3D(myPos, tPos)
            if (d < 5.0 && now < t.immunityUntil && this.hasLineOfSight(tPos)) {
              dangerousEnemy = t
              break
            }
          }

          if (dangerousEnemy) {
            const tPos = dangerousEnemy.getPosition()
            this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
            if (canSprint && this.stamina > 15) {
              wantsSprint = true
              speed = GAME_CONFIG.movement.sprintSpeed * 0.85
            } else {
              wantsSprint = false
              speed = GAME_CONFIG.movement.walkSpeed * 1.0
            }
          } else if (isImmune) {
            // IMMUNE REGROUP: Hold position in home territory until immunity expires before launching assault
            const dx = myPos.x - this.patrolCenter.x
            const dz = myPos.z - this.patrolCenter.z
            const distFromCenter = Math.sqrt(dx * dx + dz * dz)
            if (distFromCenter > 2.0) {
              this.patrolDirection.set(-dx, 0, -dz).normalize()
            } else {
              this.patrolDirection.set(Math.sin(now * 0.002), 0, Math.cos(now * 0.002)).normalize()
            }
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 0.75
          } else {
            // Drive forward across dividing line towards enemy base objective
            if (this.targetObjective) {
              const dx = this.targetObjective.x - myPos.x
              const dz = this.targetObjective.z - myPos.z
              this.patrolDirection.set(dx, 0, dz).normalize()
            } else {
              this.patrolDirection.set(-myPos.x * 0.1, 0, enemyDirZ).normalize()
            }
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 1.0
          }
        } else {
          // Defender guards home territory and catches intruders
          let targetEntity: GameplayEntity | null = null
          let targetDist = Infinity
          let isTargetDangerous = false

          for (const t of potentialTargets) {
            if (t.teamId === this.teamId || t.status === 'jailed') continue

            const tPos = t.getPosition()
            const d = GameplayRules.distance3D(myPos, tPos)
            if (d < 14.0 && d < targetDist && this.hasLineOfSight(tPos)) {
              const isTrespassing = GameplayRules.isInEnemyTerritory(t)
              const isImmune = now < t.immunityUntil

              if (isImmune) {
                targetEntity = t
                targetDist = d
                isTargetDangerous = true
              } else if (isTrespassing) {
                targetEntity = t
                targetDist = d
                isTargetDangerous = false
              }
            }
          }

          if (targetEntity && isTargetDangerous) {
            // Flee away from immune opponent!
            const tPos = targetEntity.getPosition()
            this.lastSeenTargetPos = null
            this.searchTimer = 0
            this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
            if (canSprint && this.stamina > 15) {
              wantsSprint = true
              speed = GAME_CONFIG.movement.sprintSpeed * 0.85
            } else {
              wantsSprint = false
              speed = GAME_CONFIG.movement.walkSpeed * 1.0
            }
          } else if (targetEntity) {
            // Pursuit: Chase intruder trespassing in our home territory!
            const tPos = targetEntity.getPosition()
            if (!this.lastSeenTargetPos) {
              this.lastSeenTargetPos = new THREE.Vector3()
            }
            this.lastSeenTargetPos.set(tPos.x, tPos.y, tPos.z)
            this.searchTimer = 1.5

            this.patrolDirection.set(tPos.x - myPos.x, 0, tPos.z - myPos.z).normalize()
            if (canSprint && this.stamina >= 20) {
              wantsSprint = true
              speed = GAME_CONFIG.movement.sprintSpeed * 1.0
            } else {
              wantsSprint = false
              speed = GAME_CONFIG.movement.walkSpeed * 1.0
            }
          } else if (this.lastSeenTargetPos && this.searchTimer > 0) {
            // Target broke LOS behind obstacle: move to investigate last seen position
            this.searchTimer -= dt
            const toLastX = this.lastSeenTargetPos.x - myPos.x
            const toLastZ = this.lastSeenTargetPos.z - myPos.z
            const distToLast = Math.sqrt(toLastX * toLastX + toLastZ * toLastZ)

            if (distToLast < 0.8 || this.searchTimer <= 0) {
              this.lastSeenTargetPos = null
              this.searchTimer = 0
            } else {
              this.patrolDirection.set(toLastX, 0, toLastZ).normalize()
              wantsSprint = false
              speed = GAME_CONFIG.movement.walkSpeed * 0.85
            }
          } else {
            // Normal Patrol logic
            this.patrolTimer -= dt
            if (this.patrolTimer <= 0) {
              this.patrolTimer = 2.0 + Math.random() * 3.0
              const angle = Math.random() * Math.PI * 2
              this.patrolDirection.set(Math.sin(angle), 0, Math.cos(angle))
            }

            // Leash to patrol area
            const dx = myPos.x - this.patrolCenter.x
            const dz = myPos.z - this.patrolCenter.z
            const distFromCenter = Math.sqrt(dx * dx + dz * dz)

            if (distFromCenter > this.patrolRadius) {
              this.patrolDirection.set(-dx, 0, -dz).normalize()
            }
            wantsSprint = false
            speed = GAME_CONFIG.movement.walkSpeed * 0.75
          }
        }
      }
    }

    // 2. Predictive Obstacle Avoidance & Tangent Steering
    this.wallProbeRay.origin.x = myPos.x
    this.wallProbeRay.origin.y = myPos.y
    this.wallProbeRay.origin.z = myPos.z

    this.wallProbeRay.dir.x = this.patrolDirection.x
    this.wallProbeRay.dir.y = 0
    this.wallProbeRay.dir.z = this.patrolDirection.z

    const feelerDist = 1.1 // Predictive look-ahead feeler
    const wallHit = this.physics.world.castRayAndGetNormal(
      this.wallProbeRay,
      feelerDist,
      true,
      undefined,
      undefined,
      this.collider,
    )

    let velY = this.body.linvel().y

    const isCloseToObjectiveBase =
      this.targetObjective !== null && GameplayRules.distance2D(myPos, this.targetObjective) <= 3.2

    if (!isCloseToObjectiveBase && wallHit !== null && Math.abs(wallHit.normal.y) < 0.4) {
      const nx = wallHit.normal.x
      const nz = wallHit.normal.z

      // Check for low jumpable obstacle (e.g. 0.8m fence): probe upper clearance
      this.upperClearanceRay.origin.x = myPos.x
      this.upperClearanceRay.origin.y = myPos.y + 0.6
      this.upperClearanceRay.origin.z = myPos.z
      this.upperClearanceRay.dir.x = this.patrolDirection.x
      this.upperClearanceRay.dir.y = 0
      this.upperClearanceRay.dir.z = this.patrolDirection.z

      const upperHit = this.physics.world.castRay(
        this.upperClearanceRay,
        feelerDist,
        true,
        undefined,
        undefined,
        this.collider,
      )

      if (upperHit === null && Math.abs(velY) < 0.2) {
        // Upper space is clear: jump over low fence!
        velY = GAME_CONFIG.movement.jumpImpulse
      } else {
        // High obstacle/pillar: steer along surface tangent to wrap smoothly around the corner!
        const t1x = -nz
        const t1z = nx
        const t2x = nz
        const t2z = -nx

        const targetX = this.targetObjective
          ? this.targetObjective.x - myPos.x
          : this.patrolDirection.x
        const targetZ = this.targetObjective
          ? this.targetObjective.z - myPos.z
          : this.patrolDirection.z

        const dot1 = t1x * targetX + t1z * targetZ
        const dot2 = t2x * targetX + t2z * targetZ

        const chosenTx = dot1 >= dot2 ? t1x : t2x
        const chosenTz = dot1 >= dot2 ? t1z : t2z

        // Deflect patrolDirection smoothly along the wall tangent with outward push
        const steerX = chosenTx * 0.85 + nx * 0.35
        const steerZ = chosenTz * 0.85 + nz * 0.35

        this.patrolDirection.set(steerX, 0, steerZ).normalize()
      }
    }

    // Stamina & Sprint Simulation (Equal Status with Player)
    if (wantsSprint && canSprint) {
      this.isSprinting = true
      this.stamina = Math.max(0, this.stamina - GAME_CONFIG.stamina.sprintDrainPerSecond * dt)
      if (this.stamina === 0) {
        this.status = 'stunned'
        this.stunUntil = now + GAME_CONFIG.gameplay.stunDurationMs
        this.isSprinting = false
        this.isExhausted = true
        speed = 0
        const vel = this.body.linvel()
        this.body.setLinvel({ x: 0, y: vel.y, z: 0 }, true)
        return
      }
    } else {
      this.isSprinting = false
      if (wantsSprint && !canSprint) {
        // Fallback to walk speed
        speed = Math.min(speed, GAME_CONFIG.movement.walkSpeed)
      }
      this.stamina = Math.min(
        GAME_CONFIG.stamina.max,
        this.stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
      if (this.stamina >= GAME_CONFIG.stamina.minSprintThreshold) {
        this.isExhausted = false
      }
    }

    let velX = this.patrolDirection.x * speed
    let velZ = this.patrolDirection.z * speed

    // Close-range safety slide
    const closeHit = this.physics.world.castRayAndGetNormal(
      this.wallProbeRay,
      GAME_CONFIG.movement.characterRadius + 0.15,
      true,
      undefined,
      undefined,
      this.collider,
    )

    if (closeHit !== null && Math.abs(closeHit.normal.y) < 0.4) {
      const dot = velX * closeHit.normal.x + velZ * closeHit.normal.z
      if (dot < 0) {
        velX -= closeHit.normal.x * dot
        velZ -= closeHit.normal.z * dot
      }
    }

    this.scratchVel.x = velX
    this.scratchVel.y = velY
    this.scratchVel.z = velZ

    this.body.setLinvel(this.scratchVel, true)
    if (this.patrolDirection.lengthSq() > 0.01) {
      this.targetRotationY = Math.atan2(this.patrolDirection.x, this.patrolDirection.z)
    }
  }

  public setRole(
    role: BotRole,
    targetObjective?: THREE.Vector3,
    allyJailPosition?: THREE.Vector3,
  ): void {
    this.role = role
    if (targetObjective) {
      if (!this.targetObjective) {
        this.targetObjective = new THREE.Vector3()
      }
      this.targetObjective.copy(targetObjective)
      if (!this.enemyBasePosition) {
        this.enemyBasePosition = new THREE.Vector3()
      }
      this.enemyBasePosition.copy(targetObjective)
    }
    if (allyJailPosition) {
      if (!this.allyJailPosition) {
        this.allyJailPosition = new THREE.Vector3()
      }
      this.allyJailPosition.copy(allyJailPosition)
    }
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

  public syncVisuals(alpha = 1.0, dt = 0.016, now = performance.now()): void {
    // Sub-frame linear interpolation to eliminate 60Hz/144Hz refresh-rate jitter
    this.mesh.position.lerpVectors(this.previousPosition, this.currentPosition, alpha)

    // Smooth rotational turning with frame-rate independent exponential damping
    const diff = this.targetRotationY - this.mesh.rotation.y
    const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
    const rotDamping = 1 - Math.exp(-22 * dt)
    this.mesh.rotation.y += normalizedDiff * rotDamping

    // Procedural animation: Smooth forward tilt & cute subtle chibi waddle matching player
    const currentLinVel = this.body.linvel()
    const horizSpeed = Math.sqrt(
      currentLinVel.x * currentLinVel.x + currentLinVel.z * currentLinVel.z,
    )
    const isMoving = horizSpeed > 0.4 && this.status === 'normal'

    if (isMoving) {
      const animSpeed = this.isSprinting ? 14 : 8.5
      this.runAnimCycle += dt * animSpeed
      const targetForwardTilt = this.isSprinting ? 0.14 : 0.07
      const tiltDamping = 1 - Math.exp(-14 * dt)
      this.bodyMesh.rotation.x = THREE.MathUtils.lerp(
        this.bodyMesh.rotation.x,
        targetForwardTilt,
        tiltDamping,
      )

      const waddleAmp = this.isSprinting ? 0.05 : 0.03
      this.bodyMesh.rotation.z = Math.sin(this.runAnimCycle) * waddleAmp
    } else {
      const returnDamping = 1 - Math.exp(-12 * dt)
      this.bodyMesh.rotation.x = THREE.MathUtils.lerp(this.bodyMesh.rotation.x, 0, returnDamping)
      this.bodyMesh.rotation.z = THREE.MathUtils.lerp(this.bodyMesh.rotation.z, 0, returnDamping)
    }

    // Keep bodyMesh anchored cleanly
    this.bodyMesh.position.set(0, 0, 0)

    // Procedural Jump/Fall Squash & Stretch
    if (Math.abs(currentLinVel.y) > 0.4) {
      if (currentLinVel.y > 0.4) {
        this.bodyMesh.scale.set(0.93, 1.1, 0.93)
      } else {
        this.bodyMesh.scale.set(0.96, 1.04, 0.96)
      }
    } else {
      const scaleDamping = 1 - Math.exp(-15 * dt)
      this.bodyMesh.scale.lerp(this.normalScale, scaleDamping)
    }

    // Immunity energy shield bubble visualization
    const isImmune = now < this.immunityUntil
    this.shieldBubble.update(isImmune, now)

    // Stunned dizzy stars visualization
    const isStunned = this.status === 'stunned' || now < this.stunUntil
    this.stunStarsGroup.visible = isStunned
    if (isStunned) {
      this.stunStarsGroup.rotation.y += dt * 4.5
      this.bodyMesh.rotation.z = Math.sin(now * 0.008) * 0.12
    }

    const isGrounded = Math.abs(currentLinVel.y) < 0.3
    if (!this.wasGrounded && isGrounded) {
      this.justLanded = true
      this.landSquashTimer = 0.22
    } else if (this.wasGrounded && !isGrounded && currentLinVel.y > 2.0) {
      this.justJumped = true
    }
    this.wasGrounded = isGrounded

    if (this.landSquashTimer > 0) this.landSquashTimer = Math.max(0, this.landSquashTimer - dt)
    if (this.tagSwipeTimer > 0) this.tagSwipeTimer = Math.max(0, this.tagSwipeTimer - dt)

    this.animExtras.isExhausted = this.isExhausted
    this.animExtras.tagSwipeProgress = this.tagSwipeTimer > 0 ? 1 - this.tagSwipeTimer / 0.28 : 0
    this.animExtras.landSquashProgress =
      this.landSquashTimer > 0 ? 1 - this.landSquashTimer / 0.22 : 0
    this.animExtras.isVictorious = this.isVictorious

    // Update modular 3D character avatar animation
    this.avatar.updateAnimation(
      dt,
      horizSpeed,
      isGrounded,
      this.isSprinting,
      this.status === 'stunned',
      this.status === 'jailed',
      this.animExtras,
    )

    // Overhead 3D nameplate & stamina bar update
    this.updateOverheadDisplay()
  }

  public triggerTagSwipe(): void {
    this.tagSwipeTimer = 0.28
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
    ctx.clearRect(0, 0, 256, 60)

    // 1. Top Row: Nameplate with High-Contrast Drop Outline
    const truncated = this.name.length > 14 ? this.name.substring(0, 13) + '…' : this.name
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)'
    ctx.lineWidth = 3.5
    ctx.lineJoin = 'round'
    ctx.strokeText(truncated, 128, 20)

    ctx.fillStyle = this.teamId === 'blue' ? '#93c5fd' : '#fca5a5'
    ctx.fillText(truncated, 128, 20)

    // 2. Bottom Row: Sleek Minimal Stamina Strip
    const barW = 130
    const barH = 6
    const barX = (256 - barW) / 2
    const barY = 36
    const barR = 3

    // Background Track
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'
    ctx.lineWidth = 1.5
    drawRoundedRect(ctx, barX, barY, barW, barH, barR)
    ctx.fill()
    ctx.stroke()

    // Dynamic Fill
    const ratio = Math.max(0, Math.min(1, this.stamina / GAME_CONFIG.stamina.max))
    const fillW = Math.max(0, (barW - 2) * ratio)

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

      drawRoundedRect(ctx, barX + 1, barY + 1, fillW, barH - 2, Math.max(1, barR - 1))
      ctx.fill()
    }

    if (this.overheadTexture) {
      this.overheadTexture.needsUpdate = true
    }
  }

  public setVisualOpacity(opacity: number): void {
    const isTransparent = opacity < 0.99
    this.bodyMat.transparent = isTransparent
    this.bodyMat.opacity = opacity
    this.visorMat.transparent = isTransparent
    this.visorMat.opacity = opacity
    this.avatar.setOpacity(opacity)
    if (this.overheadSprite && this.overheadSprite.material) {
      this.overheadSprite.material.opacity = opacity
    }
  }

  public setNameplateVisible(visible: boolean): void {
    if (this.overheadSprite) {
      this.overheadSprite.visible = visible
    }
  }

  public applySmokeConfound(durationMs: number): void {
    const now = performance.now()
    this.confoundedUntil = Math.max(this.confoundedUntil, now + durationMs)
  }

  public getPosition(): { x: number; y: number; z: number } {
    return this.currentPosition
  }

  public dispose(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
    this.avatar.dispose()
    this.bodyMat.dispose()
    this.visorMat.dispose()
    this.shieldBubble.dispose()
    this.stunStarGeo.dispose()
    this.stunStarMat.dispose()
    if (this.overheadTexture) {
      this.overheadTexture.dispose()
    }
    if (this.overheadSprite && this.overheadSprite.material) {
      this.overheadSprite.material.dispose()
    }
    this.physics.world.removeCollider(this.collider, false)
    this.physics.world.removeRigidBody(this.body)
  }
}
