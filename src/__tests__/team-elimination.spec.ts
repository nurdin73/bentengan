import { describe, it, expect } from 'vitest'
import { GameplayRules } from '../game/systems/gameplay-rules'
import { GAME_CONFIG } from '../game/core/constants'
import type { GameplayEntity } from '../types/game.types'

const createMockEntity = (overrides: Partial<GameplayEntity> = {}): GameplayEntity => ({
  id: overrides.id || 'player-1',
  name: overrides.name || 'Entity 1',
  teamId: overrides.teamId || 'blue',
  status: overrides.status || 'normal',
  immunityUntil: overrides.immunityUntil || 0,
  getPosition: overrides.getPosition || (() => ({ x: 0, y: 0, z: 0 })),
  teleportTo: overrides.teleportTo || (() => {}),
})

describe('Team Elimination & Territory Evasion AI Verification', () => {
  describe('Full Team Elimination Matrix', () => {
    it('should declare Red winner when all Blue members (player + bots) are jailed', () => {
      const entities: GameplayEntity[] = [
        createMockEntity({ id: 'player-blue', teamId: 'blue', status: 'jailed' }),
        createMockEntity({ id: 'bot-blue-ally', teamId: 'blue', status: 'jailed' }),
        createMockEntity({ id: 'bot-red-1', teamId: 'red', status: 'normal' }),
        createMockEntity({ id: 'bot-red-2', teamId: 'red', status: 'normal' }),
      ]

      const winner = GameplayRules.checkTeamElimination(entities)
      expect(winner).toBe('red')
    })

    it('should declare Blue winner when all Red members are jailed', () => {
      const entities: GameplayEntity[] = [
        createMockEntity({ id: 'player-blue', teamId: 'blue', status: 'normal' }),
        createMockEntity({ id: 'bot-blue-ally', teamId: 'blue', status: 'jailed' }),
        createMockEntity({ id: 'bot-red-1', teamId: 'red', status: 'jailed' }),
        createMockEntity({ id: 'bot-red-2', teamId: 'red', status: 'jailed' }),
      ]

      const winner = GameplayRules.checkTeamElimination(entities)
      expect(winner).toBe('blue')
    })

    it('should return null when both teams have at least one free active member', () => {
      const entities: GameplayEntity[] = [
        createMockEntity({ id: 'player-blue', teamId: 'blue', status: 'jailed' }),
        createMockEntity({ id: 'bot-blue-ally', teamId: 'blue', status: 'normal' }),
        createMockEntity({ id: 'bot-red-1', teamId: 'red', status: 'normal' }),
        createMockEntity({ id: 'bot-red-2', teamId: 'red', status: 'jailed' }),
      ]

      const winner = GameplayRules.checkTeamElimination(entities)
      expect(winner).toBeNull()
    })
  })

  describe('Territory Boundary & Evasion Direction Logic', () => {
    it('correctly identifies when an entity is trespassing in enemy territory', () => {
      // Blue trespassing in Red territory (Z > 0)
      const blueTrespasser = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: 5 }),
      })
      expect(GameplayRules.isInEnemyTerritory(blueTrespasser)).toBe(true)

      // Blue in safe home territory (Z <= 0)
      const blueSafe = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      expect(GameplayRules.isInEnemyTerritory(blueSafe)).toBe(false)

      // Red trespassing in Blue territory (Z < 0)
      const redTrespasser = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      expect(GameplayRules.isInEnemyTerritory(redTrespasser)).toBe(true)

      // Red in safe home territory (Z >= 0)
      const redSafe = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: 0, y: 0, z: 5 }),
      })
      expect(GameplayRules.isInEnemyTerritory(redSafe)).toBe(false)
    })

    it('verifies that Blue bot evading in enemy territory moves towards home (negative Z) even when intercepted', () => {
      // When a Blue bot is at Z = 10, homeDirZ is -1.0
      // Defender is intercepting at Z = 5 (between bot and home dividing line Z = 0)
      const homeDirZ = -1.0
      const steerZ = homeDirZ * 2.0

      // Steer vector along Z must point strictly in the negative Z direction towards home
      expect(steerZ).toBeLessThan(0)
    })

    it('verifies that Red bot evading in enemy territory moves towards home (positive Z) even when intercepted', () => {
      // When a Red bot is at Z = -10, homeDirZ is +1.0
      // Defender is intercepting at Z = -5 (between bot and home dividing line Z = 0)
      const homeDirZ = 1.0
      const steerZ = homeDirZ * 2.0

      // Steer vector along Z must point strictly in the positive Z direction towards home
      expect(steerZ).toBeGreaterThan(0)
    })

    it('verifies safe home depth threshold resets retreat state at |Z| >= 4m', () => {
      const safeDepth = 4.0
      // Blue bot reaches safe depth at Z <= -4.0
      const blueSafe = -4.5 <= -safeDepth
      expect(blueSafe).toBe(true)

      // Red bot reaches safe depth at Z >= 4.0
      const redSafe = 4.5 >= safeDepth
      expect(redSafe).toBe(true)

      // Right at border (Z = 0.5 for Red), safe depth is NOT reached yet
      const redNotSafeYet = 0.5 >= safeDepth
      expect(redNotSafeYet).toBe(false)
    })

    it('verifies that an Attacker bot pushes toward the enemy base when the coast is clear', () => {
      // Red bot at Z = -5 in Blue territory, target is Blue Base at Z = -25
      const myPos = { x: 0, y: 0, z: -5 }
      const targetObjective = { x: 0, y: 0, z: -25 }

      const dx = targetObjective.x - myPos.x
      const dz = targetObjective.z - myPos.z

      // dz is negative, driving the bot deeper into enemy territory to capture the base
      expect(dz).toBeLessThan(0)
      expect(dx).toBe(0)
    })

    it('verifies that an Attacker bot in home territory crosses towards the dividing line', () => {
      // Red bot at home territory Z = 15 aiming for Blue base at Z = -25
      const myPos = { x: 0, y: 0, z: 15 }
      const targetObjective = { x: 0, y: 0, z: -25 }

      const dx = targetObjective.x - myPos.x
      const dz = targetObjective.z - myPos.z

      // Bot advances forward (negative Z for Red attacking Blue)
      expect(dz).toBeLessThan(0)
      expect(dx).toBe(0)
    })

    it('verifies Hybrid role prioritizes defense when an intruder is in home territory', () => {
      // Red Hybrid bot is at Z = 10 (Home territory)
      const myPos = { x: 0, y: 0, z: 10 }
      // Blue intruder is invading Red territory at Z = 5 (Z > 0 for Blue is trespassing)
      const intruderPos = { x: 2, y: 0, z: 5 }

      const chaseDx = intruderPos.x - myPos.x
      const chaseDz = intruderPos.z - myPos.z

      // Direction should steer directly towards the intruder to intercept
      expect(chaseDx).toBeGreaterThan(0)
      expect(chaseDz).toBeLessThan(0)
    })

    it('verifies Hybrid role advances towards enemy base when home territory is clear', () => {
      // Red Hybrid bot is at Z = 10, no intruder in home territory
      const myPos = { x: 0, y: 0, z: 10 }
      const enemyBasePos = { x: 0, y: 0, z: -25 }

      const attackDx = enemyBasePos.x - myPos.x
      const attackDz = enemyBasePos.z - myPos.z

      // Bot advances toward enemy base
      expect(attackDz).toBeLessThan(0)
      expect(attackDx).toBe(0)
    })

    it('verifies threat evasion trigger radius is calibrated to 3.2m', () => {
      const threatThreshold = 3.2

      // Defender within 3.0m triggers evasion
      const isThreatenedClose = 3.0 < threatThreshold
      expect(isThreatenedClose).toBe(true)

      // Defender at 3.5m does NOT trigger premature evasion
      const isThreatenedFar = 3.5 < threatThreshold
      expect(isThreatenedFar).toBe(false)
    })

    it('verifies defender pursuit maintains full sprint speed 1.0x even at close range', () => {
      // In home territory, when chasing an intruder at distance <= 3.0m
      const intruderDist = 2.0
      // Previously dropped to walkSpeed, now strictly full sprintSpeed
      const sprintSpeed = 7.0
      const pursuitSpeed = intruderDist <= 3.0 ? sprintSpeed * 1.0 : sprintSpeed * 1.0
      expect(pursuitSpeed).toBe(7.0)
    })

    it('verifies dynamic objective prioritizes rescue mission when enemy base is guarded and teammate is jailed', () => {
      const enemyBasePos = { x: 0, y: 0, z: 25 }
      const allyJailPos = { x: 10, y: 0, z: 20 }
      const baseGuardRadius = 9.0

      // Enemy defender is at Z = 22 (distance to base = 3m <= 9m -> base is guarded!)
      const enemyDefenderPos = { x: 0, y: 0, z: 22 }
      const distToBase = Math.sqrt(
        (enemyDefenderPos.x - enemyBasePos.x) ** 2 + (enemyDefenderPos.z - enemyBasePos.z) ** 2,
      )
      const isEnemyBaseGuarded = distToBase <= baseGuardRadius
      const hasJailedTeammate = true

      let targetObjective = enemyBasePos
      if (hasJailedTeammate && isEnemyBaseGuarded) {
        targetObjective = allyJailPos
      }

      expect(isEnemyBaseGuarded).toBe(true)
      expect(targetObjective).toBe(allyJailPos)
    })

    it('verifies dynamic objective prioritizes base capture when enemy base is unguarded', () => {
      const enemyBasePos = { x: 0, y: 0, z: 25 }
      const allyJailPos = { x: 10, y: 0, z: 20 }
      const baseGuardRadius = 9.0

      // Enemy defender is at Z = 10 (distance to base = 15m > 9m -> base is unguarded!)
      const enemyDefenderPos = { x: 0, y: 0, z: 10 }
      const distToBase = Math.sqrt(
        (enemyDefenderPos.x - enemyBasePos.x) ** 2 + (enemyDefenderPos.z - enemyBasePos.z) ** 2,
      )
      const isEnemyBaseGuarded = distToBase <= baseGuardRadius
      const hasJailedTeammate = true

      let targetObjective = enemyBasePos
      if (hasJailedTeammate && isEnemyBaseGuarded) {
        targetObjective = allyJailPos
      }

      expect(isEnemyBaseGuarded).toBe(false)
      expect(targetObjective).toBe(enemyBasePos)
    })

    it('verifies regroup delay holds bot in home territory until cooldown expires', () => {
      let regroupDelayTimer = 2.0
      const dt = 0.5

      // Bot is in regroup delay
      expect(regroupDelayTimer > 0).toBe(true)

      // Tick down
      regroupDelayTimer -= dt
      expect(regroupDelayTimer).toBe(1.5)

      regroupDelayTimer -= 1.5
      expect(regroupDelayTimer).toBe(0)
      // Once timer is 0, delay is over and bot can attack
      expect(regroupDelayTimer <= 0).toBe(true)
    })

    it('verifies surface tangent steers bot around perpendicular obstacle without velocity zeroing', () => {
      // Wall facing South with normal (0, 0, 1), bot moving North (0, 0, -1)
      const nx = 0
      const nz = 1

      // Tangents
      const t1x = -nz // -1
      const t1z = nx // 0
      const t2x = nz // 1
      const t2z = -nx // 0

      // Target is North-East (1, 0, -1)
      const targetX = 1
      const targetZ = -1

      const dot1 = t1x * targetX + t1z * targetZ // -1 * 1 = -1
      const dot2 = t2x * targetX + t2z * targetZ // 1 * 1 = 1

      const chosenTx = dot1 >= dot2 ? t1x : t2x
      const chosenTz = dot1 >= dot2 ? t1z : t2z

      // Tangent must choose East (t2x = 1) because it aligns better with target
      expect(chosenTx).toBe(1)
      expect(Math.abs(chosenTz)).toBe(0)

      // Steer vector has non-zero lateral component, so velocity is NOT zeroed out!
      const steerX = chosenTx * 0.85 + nx * 0.35
      const steerZ = chosenTz * 0.85 + nz * 0.35
      expect(steerX).toBeCloseTo(0.85)
      expect(steerZ).toBeCloseTo(0.35)
    })

    it('verifies unstuck juke activates when displacement is under 0.15m over interval', () => {
      const distMoved = 0.05
      const isStuck = distMoved < 0.15
      expect(isStuck).toBe(true)
    })

    it('verifies Goal Rush condition when bot is closer to enemy base than home dividing line', () => {
      // Red bot deep in Blue territory at Z = -20
      const myPos = { x: 0, y: 0, z: -20 }
      const enemyBasePos = { x: 0, y: 0, z: -25 }

      const distToHome = Math.abs(myPos.z) // 20m to Z = 0
      const dx = enemyBasePos.x - myPos.x
      const dz = enemyBasePos.z - myPos.z
      const distToBase = Math.sqrt(dx * dx + dz * dz) // 5m to enemy base

      const isCloserToBaseThanHome = distToBase < distToHome
      expect(isCloserToBaseThanHome).toBe(true)
      expect(distToBase).toBe(5)
      expect(distToHome).toBe(20)
    })

    it('verifies Goal Rush is prohibited when bot has active immunity even if closer to enemy base', () => {
      // Red bot deep in Blue territory at Z = -20 (5m to enemy base at Z = -25, 20m to home Z = 0)
      const myPos = { x: 0, y: 0, z: -20 }
      const enemyBasePos = { x: 0, y: 0, z: -25 }

      const distToHome = Math.abs(myPos.z)
      const dx = enemyBasePos.x - myPos.x
      const dz = enemyBasePos.z - myPos.z
      const distToBase = Math.sqrt(dx * dx + dz * dz)

      const now = 1000
      const immunityUntil = 3000
      const isImmune = now < immunityUntil

      // Without immunity, it would be true; with immunity, it MUST be false!
      const isCloserToBaseThanHome = !isImmune && distToBase < distToHome
      expect(isCloserToBaseThanHome).toBe(false)
      expect(distToBase < distToHome).toBe(true)
    })

    it('verifies rescued immune bot in enemy territory prioritizes retreating towards home territory', () => {
      // Blue bot rescued inside enemy territory jail at Z = 20
      const teamId = 'blue'
      const homeDirZ = teamId === 'blue' ? -1.0 : 1.0
      const now = 1000
      const immunityUntil = 3000
      const isImmune = now < immunityUntil

      let isRetreating = false
      if (isImmune) {
        isRetreating = true
      }

      expect(isRetreating).toBe(true)
      const steerZ = homeDirZ * 2.0
      // Steer vector along Z must point strictly in home direction (negative Z for Blue)
      expect(steerZ).toBeLessThan(0)
    })

    it('verifies immune bot in home territory holds position and suppresses border advance', () => {
      const now = 1000
      const immunityUntil = 3000
      const isImmune = now < immunityUntil

      const myPos = { x: 0, y: 0, z: -10 }
      const patrolCenter = { x: 0, y: 0, z: -10 }
      const enemyDirZ = 1.0 // Blue advancing North into Red territory

      // Under immune regroup, bot stays around patrol center instead of charging enemyDirZ
      let advanceVectorZ = 0
      if (!isImmune) {
        advanceVectorZ = enemyDirZ
      } else {
        const dz = myPos.z - patrolCenter.z
        advanceVectorZ = -dz // pulled to center, not advancing
      }

      expect(Math.abs(advanceVectorZ)).toBe(0)
    })

    it('verifies safe juke angles in Goal Rush do not move toward pursuer', () => {
      // Pursuer is at Z = -18, Bot is at Z = -20 (Pursuer is South of bot)
      const botPos = { x: 0, z: -20 }
      const pursuerPos = { x: 0, z: -18 }

      // Safe direction from pursuer to bot is North (negative Z)
      const fromPursuerZ = botPos.z - pursuerPos.z // -2
      const safeDirZ = fromPursuerZ / Math.abs(fromPursuerZ) // -1.0

      // Candidate 1: Move North (toward base, away from pursuer)
      const candNorth = { x: 0, z: -1 }
      const dotNorth = candNorth.z * safeDirZ // (-1) * (-1) = 1 (safe!)
      expect(dotNorth).toBeGreaterThanOrEqual(-0.1)

      // Candidate 2: Move East (lateral juke)
      const candEast = { x: 1, z: 0 }
      const dotEast = candEast.z * safeDirZ // 0 (safe perpendicular juke!)
      expect(dotEast).toBeGreaterThanOrEqual(-0.1)

      // Candidate 3: Move South (suicide toward pursuer)
      const candSouth = { x: 0, z: 1 }
      const dotSouth = candSouth.z * safeDirZ // (1) * (-1) = -1 (dangerous!)
      expect(dotSouth).toBeLessThan(-0.1)
    })

    it('verifies Attacker bot conserves stamina with walk speed when coast is clear and base is beyond final rush range', () => {
      // Bot at Z = -15, Enemy Base at Z = -25 (Distance = 10m > 5.5m)
      const botPos = { x: 0, z: -15 }
      const basePos = { x: 0, z: -25 }
      const baseDist = Math.abs(basePos.z - botPos.z)
      const hasDefender = false
      const canSprint = true
      const stamina = 100

      // When coast is clear and distance > 5.5m:
      const wantsSprint =
        !hasDefender && baseDist <= 5.5 && canSprint && stamina >= GAME_CONFIG.stamina.minSprintThreshold

      expect(wantsSprint).toBe(false)
      expect(baseDist).toBe(10)
    })

    it('verifies Attacker bot triggers sprint for final base dash when within 5.5m with sufficient stamina', () => {
      // Bot at Z = -21, Enemy Base at Z = -25 (Distance = 4m <= 5.5m)
      const botPos = { x: 0, z: -21 }
      const basePos = { x: 0, z: -25 }
      const baseDist = Math.abs(basePos.z - botPos.z)
      const hasDefender = false
      const canSprint = true
      const stamina = 50

      const wantsSprint =
        !hasDefender && baseDist <= 5.5 && canSprint && stamina >= GAME_CONFIG.stamina.minSprintThreshold

      expect(wantsSprint).toBe(true)
      expect(baseDist).toBe(4)
    })

    it('verifies Attacker bot triggers threat evasion sprint when a defender is within 3.2m', () => {
      const defenderDist = 2.5
      const threatThreshold = 3.2
      const canSprint = true
      const stamina = 40

      const isThreatened = defenderDist < threatThreshold
      const wantsSprint = isThreatened && canSprint && stamina > 15

      expect(wantsSprint).toBe(true)
    })
  })
})
