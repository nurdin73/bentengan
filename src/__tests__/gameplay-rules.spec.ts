import { describe, it, expect } from 'vitest'
import { GameplayRules } from '../game/systems/gameplay-rules'
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

describe('GameplayRules — Milestone 2 Core Mechanics', () => {
  describe('Capture Validation & Traditional Bentengan Territory Rules', () => {
    it('should allow capture of an enemy player trespassing in home territory (Z < 0 for Red)', () => {
      // Blue hunter is defending home territory (Z = -5)
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      // Red target has invaded Blue territory (Z = -5, which is Z < 0)
      const target = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: 1.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.isInEnemyTerritory(target)).toBe(true)
      expect(GameplayRules.canCapture(hunter, target, 1000)).toBe(true)
    })

    it('should prevent capture of an enemy player in their own territory (Safe Home Territory)', () => {
      // Blue hunter has invaded Red territory (Z = 10)
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: 10 }),
      })
      // Red target is in their own home territory (Z = 10, which is Z >= 0)
      const target = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: 1.0, y: 0, z: 10 }),
      })

      expect(GameplayRules.isInEnemyTerritory(target)).toBe(false)
      // Hunter cannot capture target in target's home territory!
      expect(GameplayRules.canCapture(hunter, target, 1000)).toBe(false)
    })

    it('should prevent capture of teammates', () => {
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      const ally = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 1.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.canCapture(hunter, ally, 1000)).toBe(false)
    })

    it('should prevent capture when target is immune', () => {
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      const immuneTarget = createMockEntity({
        teamId: 'red',
        immunityUntil: 5000,
        getPosition: () => ({ x: 1.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.canCapture(hunter, immuneTarget, 3000)).toBe(false)
      // Allowed once immunity expires
      expect(GameplayRules.canCapture(hunter, immuneTarget, 6000)).toBe(true)
    })

    it('should allow capturing a stunned enemy trespassing in territory', () => {
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      const stunnedTarget = createMockEntity({
        teamId: 'red',
        status: 'stunned',
        getPosition: () => ({ x: 1.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.canCapture(hunter, stunnedTarget, 1000)).toBe(true)
    })

    it('should prevent capture if target is already jailed', () => {
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      const jailedTarget = createMockEntity({
        teamId: 'red',
        status: 'jailed',
        getPosition: () => ({ x: 1.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.canCapture(hunter, jailedTarget, 1000)).toBe(false)
    })

    it('should reject capture when distance exceeds 1.5m', () => {
      const hunter = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -5 }),
      })
      const farTarget = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: 2.0, y: 0, z: -5 }),
      })

      expect(GameplayRules.canCapture(hunter, farTarget, 1000)).toBe(false)
    })
  })

  describe('Rescue Validation', () => {
    it('should allow rescuing a jailed teammate within 1.5m', () => {
      const rescuer = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 10, y: 0, z: 20 }),
      })
      const jailedAlly = createMockEntity({
        teamId: 'blue',
        status: 'jailed',
        getPosition: () => ({ x: 10.8, y: 0, z: 20 }),
      })

      expect(GameplayRules.canRescue(rescuer, jailedAlly)).toBe(true)
    })

    it('should not allow rescuing enemies in jail', () => {
      const rescuer = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 10, y: 0, z: 20 }),
      })
      const jailedEnemy = createMockEntity({
        teamId: 'red',
        status: 'jailed',
        getPosition: () => ({ x: 10.8, y: 0, z: 20 }),
      })

      expect(GameplayRules.canRescue(rescuer, jailedEnemy)).toBe(false)
    })

    it('should not allow an already jailed player to rescue someone', () => {
      const jailedRescuer = createMockEntity({
        teamId: 'blue',
        status: 'jailed',
        getPosition: () => ({ x: 10, y: 0, z: 20 }),
      })
      const jailedAlly = createMockEntity({
        teamId: 'blue',
        status: 'jailed',
        getPosition: () => ({ x: 10.8, y: 0, z: 20 }),
      })

      expect(GameplayRules.canRescue(jailedRescuer, jailedAlly)).toBe(false)
    })

    it('should validate proximity touch / tempel when rescuer physically contacts jailed ally', () => {
      const touchingRescuer = createMockEntity({
        teamId: 'red',
        getPosition: () => ({ x: -10, y: 0, z: -20 }),
      })
      const jailedTeammate = createMockEntity({
        teamId: 'red',
        status: 'jailed',
        getPosition: () => ({ x: -10.5, y: 0, z: -20 }),
      })

      // Distance is 0.5m, within direct physical contact/touch radius
      expect(GameplayRules.canRescue(touchingRescuer, jailedTeammate)).toBe(true)
    })

    it('should not allow a stunned player to rescue someone', () => {
      const stunnedRescuer = createMockEntity({
        teamId: 'blue',
        status: 'stunned',
        getPosition: () => ({ x: 10, y: 0, z: 20 }),
      })
      const jailedAlly = createMockEntity({
        teamId: 'blue',
        status: 'jailed',
        getPosition: () => ({ x: 10.5, y: 0, z: 20 }),
      })

      expect(GameplayRules.canRescue(stunnedRescuer, jailedAlly)).toBe(false)
    })
  })

  describe('Victory Conditions', () => {
    it('should trigger victory on enemy base capture', () => {
      const redBasePos = { x: 0, y: 0, z: 25 }
      const bluePlayer = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0.5, y: 0, z: 24.5 }), // within 2.6m radius
      })

      expect(GameplayRules.canCaptureBase(bluePlayer, 'red', redBasePos)).toBe(true)
    })

    it('should allow base capture when entity touches pillar corner at 2.1m or ring at 2.5m', () => {
      const redBasePos = { x: 0, y: 0, z: 25 }
      // Entity touching pillar corner at ~2.1m
      const cornerToucher = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 1.5, y: 0, z: 26.5 }), // dist = sqrt(1.5^2 + 1.5^2) = ~2.12m
      })
      expect(GameplayRules.canCaptureBase(cornerToucher, 'red', redBasePos)).toBe(true)

      // Entity stepping on base ring at 2.5m
      const ringStepper = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: 22.5 }), // dist = 2.5m
      })
      expect(GameplayRules.canCaptureBase(ringStepper, 'red', redBasePos)).toBe(true)

      // Entity outside base ring at 2.8m
      const farEntity = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: 22.2 }), // dist = 2.8m
      })
      expect(GameplayRules.canCaptureBase(farEntity, 'red', redBasePos)).toBe(false)
    })

    it('should allow an immune player to capture enemy base', () => {
      const redBasePos = { x: 0, y: 0, z: 25 }
      const immuneBluePlayer = createMockEntity({
        teamId: 'blue',
        immunityUntil: 999999,
        getPosition: () => ({ x: 0.5, y: 0, z: 24.5 }),
      })

      expect(GameplayRules.canCaptureBase(immuneBluePlayer, 'red', redBasePos)).toBe(true)
    })

    it('should prevent player from capturing their own base', () => {
      const blueBasePos = { x: 0, y: 0, z: -25 }
      const bluePlayer = createMockEntity({
        teamId: 'blue',
        getPosition: () => ({ x: 0, y: 0, z: -25 }),
      })

      expect(GameplayRules.canCaptureBase(bluePlayer, 'blue', blueBasePos)).toBe(false)
    })

    it('should declare team elimination winner when all opponents are jailed', () => {
      const blue1 = createMockEntity({ id: 'b1', teamId: 'blue', status: 'normal' })
      const red1 = createMockEntity({ id: 'r1', teamId: 'red', status: 'jailed' })
      const red2 = createMockEntity({ id: 'r2', teamId: 'red', status: 'jailed' })

      expect(GameplayRules.checkTeamElimination([blue1, red1, red2])).toBe('blue')

      // If one red player is free, no winner yet
      const red2Free = createMockEntity({ id: 'r2', teamId: 'red', status: 'normal' })
      expect(GameplayRules.checkTeamElimination([blue1, red1, red2Free])).toBeNull()
    })
  })
})
