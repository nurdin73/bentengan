import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import type { GameplayEntity, PlayerStatus, TeamId } from '../../types/game.types'
import { GameplayRules } from '../systems/gameplay-rules'
import { GAME_CONFIG } from '../core/constants'

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
  public readonly body: RAPIER.RigidBody
  public readonly collider: RAPIER.Collider

  private readonly physics: PhysicsWorld

  // Gameplay state
  public status: PlayerStatus = 'normal'
  public immunityUntil = 0
  public stunUntil = 0

  // Visual interpolation transforms
  public readonly previousPosition = new THREE.Vector3()
  public readonly currentPosition = new THREE.Vector3()
  private targetRotationY = 0

  // Patrol / AI state
  private patrolCenter: THREE.Vector3
  private patrolRadius: number
  private patrolTimer = 0
  private patrolDirection = new THREE.Vector3()

  // Materials & visual cues
  private readonly bodyMat: THREE.MeshStandardMaterial
  private readonly visorMat: THREE.MeshStandardMaterial
  private readonly immunityAuraMesh: THREE.Mesh
  private readonly immunityAuraMat: THREE.MeshBasicMaterial

  // Dizzy / Stunned visual orbit
  public readonly stunStarsGroup: THREE.Group
  private readonly stunStarGeo: THREE.OctahedronGeometry
  private readonly stunStarMat: THREE.MeshBasicMaterial

  // Scratch objects (Rule 3.A)
  private readonly scratchVel = { x: 0, y: 0, z: 0 }
  private readonly wallProbeRay: RAPIER.Ray
  private readonly upperClearanceRay: RAPIER.Ray

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
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat)
    bodyMesh.castShadow = true
    this.mesh.add(bodyMesh)

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.2)
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
    const visor = new THREE.Mesh(visorGeo, this.visorMat)
    visor.position.set(0, characterHeight * 0.25, characterRadius * 0.9)
    this.mesh.add(visor)

    // Immunity aura
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

  public updateFixed(dt: number, now: number, potentialTargets: GameplayEntity[] = []): void {
    if (this.status === 'stunned') {
      if (now >= this.stunUntil) {
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

      if (hasJailedTeammate && isEnemyBaseGuarded && this.allyJailPosition) {
        // Base is guarded and a teammate is in jail: prioritize rescue mission!
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

    const isSelfTrespassing = GameplayRules.isInEnemyTerritory(this)
    const homeDirZ = this.teamId === 'blue' ? -1.0 : 1.0
    const enemyDirZ = -homeDirZ
    const isImmune = now < this.immunityUntil
    let speed = GAME_CONFIG.movement.walkSpeed * 0.75

    if (isSelfTrespassing) {
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
        const d = GameplayRules.distance3D(myPos, t.getPosition())
        // Threat range: 3.2 meters
        if (d < 3.2 && d < nearestDefenderDist) {
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
          speed = GAME_CONFIG.movement.sprintSpeed * 0.95
        } else {
          // Coast is clear: sprint directly to enemy base pillar!
          this.patrolDirection.set(baseNormX, 0, baseNormZ).normalize()
          speed = GAME_CONFIG.movement.sprintSpeed * 0.9
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
          speed = GAME_CONFIG.movement.sprintSpeed * 0.88
        } else {
          if (this.targetObjective) {
            const dx = this.targetObjective.x - myPos.x
            const dz = this.targetObjective.z - myPos.z
            this.patrolDirection.set(dx, 0, dz).normalize()
            speed = GAME_CONFIG.movement.walkSpeed * 1.15
          } else {
            this.patrolDirection.set(-myPos.x * 0.1, 0, enemyDirZ).normalize()
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
          speed = GAME_CONFIG.movement.sprintSpeed * 0.85
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
            const d = GameplayRules.distance3D(myPos, t.getPosition())
            if (d < intruderDist) {
              intruderInHome = t
              intruderDist = d
              isIntruderImmune = now < t.immunityUntil
            }
          }
        }

        if (intruderInHome) {
          // SUB-STATE DEFENDER: Intruder in home yard! Protect benteng and intercept
          if (isIntruderImmune) {
            const tPos = intruderInHome.getPosition()
            this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
            speed = GAME_CONFIG.movement.sprintSpeed * 0.85
          } else {
            const tPos = intruderInHome.getPosition()
            this.patrolDirection.set(tPos.x - myPos.x, 0, tPos.z - myPos.z).normalize()
            speed = GAME_CONFIG.movement.sprintSpeed * 1.0
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
          speed = GAME_CONFIG.movement.walkSpeed * 1.1
        }
      } else if (this.role === 'attacker') {
        // Attacker prioritizes crossing the center border to attack enemy base
        let dangerousEnemy: GameplayEntity | null = null
        for (const t of potentialTargets) {
          if (t.teamId === this.teamId || t.status === 'jailed') continue
          const d = GameplayRules.distance3D(myPos, t.getPosition())
          if (d < 5.0 && now < t.immunityUntil) {
            dangerousEnemy = t
            break
          }
        }

        if (dangerousEnemy) {
          const tPos = dangerousEnemy.getPosition()
          this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
          speed = GAME_CONFIG.movement.sprintSpeed * 0.85
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
          speed = GAME_CONFIG.movement.walkSpeed * 1.05
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
          if (d < 14.0 && d < targetDist) {
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
          this.patrolDirection.set(myPos.x - tPos.x, 0, myPos.z - tPos.z).normalize()
          speed = GAME_CONFIG.movement.sprintSpeed * 0.85
        } else if (targetEntity) {
          // Pursuit: Chase intruder trespassing in our home territory!
          const tPos = targetEntity.getPosition()
          this.patrolDirection.set(tPos.x - myPos.x, 0, tPos.z - myPos.z).normalize()
          speed = GAME_CONFIG.movement.sprintSpeed * 1.0
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
      this.targetObjective !== null &&
      GameplayRules.distance2D(myPos, this.targetObjective) <= 3.2

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

  public syncVisuals(alpha = 1.0, now = performance.now()): void {
    this.mesh.position.lerpVectors(this.previousPosition, this.currentPosition, alpha)

    const diff = this.targetRotationY - this.mesh.rotation.y
    const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.mesh.rotation.y += normalizedDiff * 0.2

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
  }

  public getPosition(): { x: number; y: number; z: number } {
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
    this.physics.world.removeCollider(this.collider, false)
    this.physics.world.removeRigidBody(this.body)
  }
}
